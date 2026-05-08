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
from shared.database import insert_snapshot, upsert_prediction, update_anomaly_scores
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

    # 1. Update anomaly scores on the existing prediction row
    await update_anomaly_scores(
        bearing_id    = prediction.bearing_id,
        file_idx      = prediction.file_idx,
        model_version = prediction.model_version,
        stat_score    = trigger.stat_score,
        rul_drop_score= trigger.rul_drop_score,
        hybrid_score  = trigger.hybrid_score,
        threshold_tau = None,   # tau is config-level, not per-row
    )

    # 2. Upload raw signal to MinIO if provided
    signal_window_ref: Optional[str] = None
    if h_signal is not None and v_signal is not None:
        try:
            signal_window_ref = await upload_signal(
                prediction.bearing_id,
                prediction.file_idx,
                np.stack([h_signal, v_signal], axis=0),
            )
        except Exception as exc:
            log.warning("Signal upload failed (non-fatal): %s", exc)

    # 3. Get prediction UUID (already in DB from predictor service)
    prediction_id = await _get_prediction_id(prediction)

    # 4. Check safety redlines
    safety_context = _build_safety_context(prediction)

    # 5. Build SnapshotPayload
    snapshot = SnapshotPayload(
        bearing_id        = prediction.bearing_id,
        prediction_id     = prediction_id,
        snapshot_ts       = datetime.now(timezone.utc),
        trigger_source    = trigger_source,
        signal_window_ref = signal_window_ref,
        prediction        = prediction,
        operation_context = _build_operation_context(prediction),
        cost_context      = _build_cost_context(prediction),
        safety_context    = safety_context,
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
    """Synthetic operational context for production agent reasoning."""
    # In production these would come from an ERP/SCADA system
    return {
        "shift":                  "day",
        "production_schedule":    "normal",
        "planned_maintenance_in": 480,   # minutes until next planned window
        "throughput_priority":    "medium",
        "bearing_criticality":    "high",
        "last_maintenance_ago":   2160,  # minutes (36 hours)
    }


def _build_cost_context(pred: PredictionRecord) -> dict:
    """Synthetic cost context for cost agent reasoning."""
    return {
        "c_planned_maintenance":  1200,    # USD
        "c_emergency_repair":     11000,   # USD
        "c_inspection":           300,     # USD
        "c_production_loss_per_h": 800,    # USD
        "cost_threshold_tau":     0.11,    # C_planned / (C_planned + C_emergency)
        "p_fail":                 pred.p_fail,
        "expected_cost_continue": round(pred.p_fail * 11000, 2),
        "expected_cost_inspect":  round(300 + pred.p_fail * 0.5 * 11000, 2),
    }
