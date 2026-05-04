from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import asyncpg

from shared.config import settings
from shared.schemas import (
    AgentTranscriptEntry,
    DecisionActionRecord,
    NegotiationRecord,
    PredictionRecord,
    SnapshotPayload,
)

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


# Pool lifecycle

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.postgre_dsn,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("PostgreSQL connection pool created")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")


@asynccontextmanager
async def acquire() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


@asynccontextmanager
async def transaction() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            yield conn


# Bearings

async def get_bearing_uuid(bearing_id: str) -> str:
    """Resolve business ID (e.g. 'XJT-B1') -> internal UUID."""
    async with acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM bearings WHERE bearing_id = $1 AND active = true",
            bearing_id,
        )
    if row is None:
        raise ValueError(f"Bearing '{bearing_id}' not found or inactive")
    return str(row["id"])


# Predictions

async def upsert_prediction(record: PredictionRecord) -> str:
    """
    Insert or update a prediction row.
    Returns the prediction UUID (needed when creating a snapshot).
    """
    bearing_uuid = await get_bearing_uuid(record.bearing_id)

    async with acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO predictions (
                bearing_id, file_idx, sample_ts,
                rul_minutes, rul_lower_minutes, rul_upper_minutes, rul_uncertainty,
                p_fail, health_score,
                degradation_rate, ood_flag,
                fault_type, fault_confidence,
                stat_score, rul_drop_score, hybrid_score, threshold_tau,
                model_version, pipeline_run_id
            ) VALUES (
                $1, $2, $3,
                $4, $5, $6, $7,
                $8, $9,
                $10, $11,
                $12::"FaultType", $13,
                $14, $15, $16, $17,
                $18, $19
            )
            ON CONFLICT (bearing_id, file_idx, model_version) DO UPDATE SET
                sample_ts         = EXCLUDED.sample_ts,
                rul_minutes       = EXCLUDED.rul_minutes,
                rul_lower_minutes = EXCLUDED.rul_lower_minutes,
                rul_upper_minutes = EXCLUDED.rul_upper_minutes,
                rul_uncertainty   = EXCLUDED.rul_uncertainty,
                p_fail            = EXCLUDED.p_fail,
                health_score      = EXCLUDED.health_score,
                degradation_rate  = EXCLUDED.degradation_rate,
                ood_flag          = EXCLUDED.ood_flag,
                fault_type        = EXCLUDED.fault_type,
                fault_confidence  = EXCLUDED.fault_confidence,
                pipeline_run_id   = EXCLUDED.pipeline_run_id
            RETURNING id
            """,
            bearing_uuid, record.file_idx, record.sample_ts,
            record.rul_minutes, record.rul_lower_minutes,
            record.rul_upper_minutes, record.rul_uncertainty,
            record.p_fail, record.health_score,
            record.degradation_rate, record.ood_flag,
            record.fault_type, record.fault_confidence,
            record.stat_score, record.rul_drop_score,
            record.hybrid_score, record.threshold_tau,
            record.model_version, record.pipeline_run_id,
        )
    return str(row["id"])


async def update_anomaly_scores(
    bearing_id: str,
    file_idx: int,
    model_version: str,
    stat_score: Optional[float],
    rul_drop_score: Optional[float],
    hybrid_score: Optional[float],
    threshold_tau: Optional[float],
) -> None:
    """
    Called by anomaly service to fill in scores after predictor has
    already INSERT-ed the row.
    """
    bearing_uuid = await get_bearing_uuid(bearing_id)
    async with acquire() as conn:
        await conn.execute(
            """
            UPDATE predictions
            SET stat_score     = $4,
                rul_drop_score = $5,
                hybrid_score   = $6,
                threshold_tau  = $7
            WHERE bearing_id   = $1
              AND file_idx      = $2
              AND model_version = $3
            """,
            bearing_uuid, file_idx, model_version,
            stat_score, rul_drop_score, hybrid_score, threshold_tau,
        )


# Snapshots

async def insert_snapshot(snapshot: SnapshotPayload) -> str:
    """Create a snapshot row. Returns snapshot UUID."""
    bearing_uuid = await get_bearing_uuid(snapshot.bearing_id)

    summary = {
        "rul_minutes":  snapshot.prediction.rul_minutes,
        "p_fail":       snapshot.prediction.p_fail,
        "health_score": snapshot.prediction.health_score,
        "fault_type":   snapshot.prediction.fault_type,
        "hybrid_score": snapshot.prediction.hybrid_score,
    }

    async with acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO snapshots (
                bearing_id, prediction_id, snapshot_ts,
                status, trigger_source,
                feature_vector_ref, signal_window_ref,
                summary_json
            ) VALUES (
                $1, $2, $3,
                $4, $5::"TriggerSource",
                $6, $7,
                $8
            )
            RETURNING id
            """,
            bearing_uuid,
            snapshot.prediction_id,
            snapshot.snapshot_ts,
            "PENDING_REVIEW",
            snapshot.trigger_source,
            snapshot.feature_vector_ref,
            snapshot.signal_window_ref,
            summary,          # asyncpg JSONB codec nhận dict trực tiếp, không cần json.dumps
        )
    return str(row["id"])


# Decisions

async def insert_decision(snapshot_id: str, output: NegotiationRecord) -> str:
    """
    Persist negotiation result as a Decision row.
    No decision_type column — recommended_action captures the AI intent fully.
    NegotiationRecord.reasoning_summary maps to DB column reason_summary.
    """
    async with acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO decisions (
                snapshot_id,
                recommended_action,
                recommended_confidence,
                decision_status,
                priority,
                safety_veto,
                reason_summary
            ) VALUES (
                $1,
                $2::"ActionType",
                $3,
                'PENDING'::"DecisionStatus",
                $4::"PriorityLevel",
                $5,
                $6
            )
            RETURNING id
            """,
            snapshot_id,
            output.recommended_action,
            output.recommended_confidence,
            output.priority,
            output.safety_veto,
            output.reasoning_summary,
        )
    return str(row["id"])


# Agent transcripts

async def insert_agent_transcript(entry: AgentTranscriptEntry) -> None:
    """
    Persist one turn of the agent negotiation transcript.
    entry.reasoning (schema field) -> reasoning_text (DB column).
    """
    async with acquire() as conn:
        await conn.execute(
            """
            INSERT INTO agent_transcripts (
                snapshot_id, round_no, agent_name,
                message_type, action_candidate, confidence,
                reasoning_text
            ) VALUES (
                $1, $2, $3,
                $4::"AgentMessageType", $5::"ActionType", $6,
                $7
            )
            """,
            entry.snapshot_id,
            entry.round_no,
            entry.agent_name,
            entry.message_type,
            entry.action_candidate,
            entry.confidence,
            entry.reasoning,
        )


# Decision actions

async def insert_decision_action(decision_id: str, record: DecisionActionRecord) -> None:
    """
    Persist operator action and atomically mark the parent decision RESOLVED.

    decision_id is passed explicitly — DecisionActionRecord.decison_id is
    an internal record UUID, not the FK to the decisions table.
    """
    async with transaction() as conn:
        await conn.execute(
            """
            INSERT INTO decision_actions (
                decision_id, action, final_action,
                override_reason, actor_user_id, actor_role, source
            ) VALUES (
                $1,
                $2::"OperatorAction",
                $3::"ActionType",
                $4, $5, $6,
                $7::"ActionSource"
            )
            """,
            decision_id,
            record.action,
            record.final_action,
            record.override_reason,
            record.actor_user_id,
            record.actor_role,
            record.source,
        )
        await conn.execute(
            """
            UPDATE decisions
            SET decision_status = 'RESOLVED'::"DecisionStatus",
                resolved_at     = NOW()
            WHERE id = $1
            """,
            decision_id,
        )


# Read operations

async def get_recent_predictions(bearing_id: str, limit: int = 50) -> list[dict]:
    bearing_uuid = await get_bearing_uuid(bearing_id)
    async with acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM predictions
            WHERE bearing_id = $1
            ORDER BY sample_ts DESC
            LIMIT $2
            """,
            bearing_uuid, limit,
        )
    return [dict(r) for r in rows]


async def get_latest_prediction(bearing_id: str) -> Optional[dict]:
    bearing_uuid = await get_bearing_uuid(bearing_id)
    async with acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM predictions
            WHERE bearing_id = $1
            ORDER BY sample_ts DESC
            LIMIT 1
            """,
            bearing_uuid,
        )
    return dict(row) if row else None


async def get_pending_snapshots(limit: int = 20) -> list[dict]:
    """Return snapshots that have no decision yet or are still PENDING."""
    async with acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT s.*
            FROM snapshots s
            LEFT JOIN decisions d ON d.snapshot_id = s.id
            WHERE d.id IS NULL
               OR d.decision_status = 'PENDING'::"DecisionStatus"
            ORDER BY s.snapshot_ts DESC
            LIMIT $1
            """,
            limit,
        )
    return [dict(r) for r in rows]


async def get_decision_for_snapshot(snapshot_id: str) -> Optional[dict]:
    async with acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM decisions WHERE snapshot_id = $1",
            snapshot_id,
        )
    return dict(row) if row else None


async def is_resolved(snapshot_id: str) -> bool:
    decision = await get_decision_for_snapshot(snapshot_id)
    if decision is None:
        return False
    return decision["decision_status"] == "RESOLVED"