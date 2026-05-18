"""
Build a SnapshotPayload when anomaly is triggered and persist it.

Steps:
1. Upload raw signal to MinIO  →  signal_window_ref
2. Check safety redlines
3. Compose SnapshotPayload with synthetic operation/cost/safety context
4. Persist to Postgres (snapshots table)
5. Publish snapshot_id to topic pdm.snapshots
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np

from anomaly.anomaly_detector import TriggerInfo
from shared.database import insert_snapshot, update_anomaly_scores
from shared.messaging import publish_snapshot
from shared.schemas import PredictionRecord, SnapshotPayload, TriggerSource
from shared.storage import upload_signal

log = logging.getLogger(__name__)


async def build_and_persist(
    prediction:   PredictionRecord,
    trigger:      TriggerInfo,
    h_signal:     Optional[np.ndarray] = None,
    v_signal:     Optional[np.ndarray] = None,
    trigger_source: TriggerSource = "ANOMALY_TRIGGER",
) -> SnapshotPayload:
    """
    Called by detector_runner when anomaly is triggered.
    Returns the SnapshotPayload (also persisted + published).
    """

    prediction = _sanitize_prediction(prediction)

    scored_prediction = prediction.model_copy(update={
        "stat_score": trigger.stat_score,
        "rul_drop_score": trigger.rul_drop_score,
        "hybrid_score": trigger.hybrid_score,
        "threshold_tau": None,
    })

    # 1. Update anomaly scores on the existing prediction row
    rows_affected = await update_anomaly_scores(
        bearing_id    = prediction.bearing_id,
        file_idx      = prediction.file_idx,
        model_version = prediction.model_version,
        stat_score    = trigger.stat_score,
        rul_drop_score= trigger.rul_drop_score,
        hybrid_score  = trigger.hybrid_score,
        threshold_tau = None,   # tau is config-level, not per-row
    )

    # 2. Resolve signal_window_ref.
    # Prefer a fresh upload if raw channels are supplied (richer copy).
    # Fall back to the ref already carried on the PredictionRecord, which
    # was uploaded by ingestion and propagated through the pipeline.
    signal_window_ref: Optional[str] = prediction.signal_window_ref
    if h_signal is not None and v_signal is not None:
        try:
            signal_window_ref = await upload_signal(
                prediction.bearing_id,
                prediction.file_idx,
                np.stack([h_signal, v_signal], axis=0),
            )
        except Exception as exc:
            log.warning("Signal upload failed (non-fatal): %s", exc)

    if rows_affected == 0:
        log.error(
            "Prediction row missing while updating anomaly scores: bearing=%s file=%d model=%s",
            prediction.bearing_id,
            prediction.file_idx,
            prediction.model_version,
        )

    # 3. Get prediction UUID (already in DB from predictor service)
    # If predictor DB write failed, this upsert persists the scored prediction.
    prediction_id = await _get_prediction_id(scored_prediction)

    # 4. Check safety redlines
    safety_context = _build_safety_context(prediction)

    # 5. Build SnapshotPayload
    snapshot = SnapshotPayload(
        bearing_id         = prediction.bearing_id,
        prediction_id      = prediction_id,
        snapshot_ts        = datetime.now(timezone.utc),
        trigger_source     = trigger_source,
        signal_window_ref  = signal_window_ref,
        feature_vector_ref = prediction.feature_vector_ref,   # propagated from signal_processor
        prediction         = scored_prediction,
        operation_context  = _build_operation_context(prediction),
        cost_context       = _build_cost_context(prediction),
        safety_context     = safety_context,
    )

    # 6. Persist to Postgres
    snapshot_uuid = await insert_snapshot(snapshot)
    log.info(
        "Snapshot %s persisted for bearing=%s file=%d hybrid=%.3f",
        snapshot_uuid, prediction.bearing_id, prediction.file_idx, trigger.hybrid_score,
    )

    # 7. Publish to Kafka for orchestrator
    await publish_snapshot(snapshot)

    return snapshot


async def _get_prediction_id(prediction: PredictionRecord) -> str:
    """
    Upsert ensures the prediction row exists and returns its UUID.
    predictor service should have already inserted it, so this is mostly a no-op.
    """
    from shared.database import upsert_prediction
    return await upsert_prediction(prediction)


def _sanitize_prediction(pred: PredictionRecord) -> PredictionRecord:
    """Clamp fields used by downstream agents to their valid ranges.

    Why: a malformed prediction (negative RUL, p_fail outside [0,1]) can steer
    the multi-agent negotiation into nonsense decisions. Clamp at the boundary
    rather than crash so the pipeline keeps moving, but log loudly.
    """
    updates: dict = {}

    if not (0.0 <= pred.p_fail <= 1.0):
        log.error(
            "p_fail out of [0,1] for bearing=%s file=%s: %.4f — clamping",
            pred.bearing_id, pred.file_idx, pred.p_fail,
        )
        updates["p_fail"] = max(0.0, min(1.0, pred.p_fail))

    if pred.rul_minutes is not None and pred.rul_minutes < 0:
        log.error(
            "Negative RUL for bearing=%s file=%s: %.2f — clamping to 0",
            pred.bearing_id, pred.file_idx, pred.rul_minutes,
        )
        updates["rul_minutes"] = 0.0

    if not (0.0 <= pred.health_score <= 100.0):
        log.warning(
            "health_score out of [0,100] for bearing=%s: %.2f — clamping",
            pred.bearing_id, pred.health_score,
        )
        updates["health_score"] = max(0.0, min(100.0, pred.health_score))

    return pred.model_copy(update=updates) if updates else pred


def _build_safety_context(pred: PredictionRecord) -> dict:
    violated = []
    if pred.health_score < 20.0:
        violated.append("health_score_critical")
    if pred.rul_minutes is not None and pred.rul_minutes < 30.0:
        violated.append("rul_below_30min")
    if pred.ood_flag:
        violated.append("ood_flag")

    return {
        "violated":               violated,
        "safety_veto_applicable": len(violated) > 0,
        "vibration_redline_g":    20.0,
        "crest_factor_redline":   6.0,
    }


def _build_operation_context(pred: PredictionRecord) -> dict:
    """Synthetic operational context for production agent reasoning.

    Keys must match what ProductionAgent._format_prompt reads:
      shift_remaining_hours, throughput_priority, scheduled_maintenance_in_hours
    In production these would come from an ERP/SCADA system.
    """
    return {
        "shift_remaining_hours":          4.0,    # hours left in current shift
        "throughput_priority":            0.7,    # 0–1 scale
        "scheduled_maintenance_in_hours": 8.0,    # next planned window
        "bearing_criticality":            "high",
        "last_maintenance_ago_hours":     36.0,
    }


def _build_cost_context(pred: PredictionRecord) -> dict:
    """Synthetic cost context for cost agent reasoning.

    Keys must match what CostAgent._expected_costs reads:
      C_planned, C_emergency, C_inspect
    """
    c_planned   = 1200    # USD — planned maintenance
    c_emergency = 11000   # USD — emergency repair
    c_inspect   = 300     # USD — inspection
    return {
        "C_planned":   c_planned,
        "C_emergency": c_emergency,
        "C_inspect":   c_inspect,
        "c_production_loss_per_h": 800,   # USD — for reference / future agents
        "cost_threshold_tau":      round(c_planned / (c_planned + c_emergency), 4),
    }
