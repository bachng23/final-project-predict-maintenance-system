from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
import yaml
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from loguru import logger
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel

from orchestrator.agents.cost_agent import CostAgent
from orchestrator.agents.health_agent import HealthAgent
from orchestrator.agents.production_agent import ProductionAgent
from orchestrator.agents.safety_agent import SafetyAgent
from orchestrator.gate import GateResult, decision_gate
from orchestrator.graph import build_negotiation_graph
from orchestrator.metrics import (
    anomaly_triggers_total,
    decisions_total,
    negotiation_duration_seconds,
    negotiation_rounds,
    override_rate,
    safety_veto_total,
)
from orchestrator.tracing import create_trace, flush as flush_langfuse
from shared import database as db
from shared import messaging
from shared.config import settings
from shared.schemas import DecisionActionRecord, NegotiationRecord, SnapshotPayload

_AUDIT_DIR = Path(settings.AUDIT_DIR)

logger.remove()
logger.configure(extra={"bearing_id": "-"})
logger.add(
    sys.stdout,
    format="{time:ISO8601} level={level} service=orchestrator bearing_id={extra[bearing_id]} event={message}",
    serialize=False,
)

_CONFIG_DIR = Path(__file__).parent.parent / "configs"
_consumer_task: asyncio.Task | None = None
_consumer_alive: bool = False          # set/cleared by supervisor loop
_CONSUMER_MAX_BACKOFF: float = 60.0    # seconds


class HITLSubmitRequest(BaseModel):
    decision_id: str
    operator_action: str
    final_decision: str
    override_reason: Optional[str] = None
    actor_user_id: str
    actor_role: str = "OPERATOR"
    source: str = "WEB_UI"


class DemoStartRequest(BaseModel):
    bearing_id: str
    speed: int = 15


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _consumer_task
    try:
        await asyncio.wait_for(db.get_pool(), timeout=3)
    except Exception:
        logger.exception("Database unavailable during orchestrator startup; continuing without DB pool")

    _consumer_task = asyncio.create_task(_snapshot_consumer_loop())
    yield

    if _consumer_task:
        _consumer_task.cancel()
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass
    await db.close_pool()
    await messaging.close_producer()


app = FastAPI(title="PdM Orchestrator", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    ollama_status = "ok"
    db_status = "ok"
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            await client.get(f"{settings.ollama_url}/api/tags")
    except Exception:
        ollama_status = "error"

    try:
        await asyncio.wait_for(db.get_pool(), timeout=2)
    except Exception:
        db_status = "error"

    consumer_status = "ok" if _consumer_alive else "down"
    overall = "ok" if db_status == "ok" and _consumer_alive else "degraded"
    return {
        "status": overall,
        "ollama": ollama_status,
        "openrouter": "configured" if settings.OPENROUTER_API_KEY else "not_configured",
        "db": db_status,
        "kafka_consumer": consumer_status,
    }


@app.post("/negotiate", response_model=NegotiationRecord)
async def negotiate(snapshot: SnapshotPayload) -> NegotiationRecord:
    return await _run_negotiate(snapshot, persist=True)


@app.get("/snapshots/pending")
async def pending_snapshots(limit: int = 20) -> list[dict]:
    try:
        return await db.get_pending_snapshots(limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc


@app.post("/hitl/submit")
async def submit_hitl(request: HITLSubmitRequest) -> dict:
    record = DecisionActionRecord(
        action=request.operator_action,
        final_action=request.final_decision,
        override_reason=request.override_reason,
        actor_user_id=request.actor_user_id,
        actor_role=request.actor_role,
        source=request.source,
    )
    try:
        await db.insert_decision_action(request.decision_id, record)
        await _update_override_rate_gauge()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not persist HITL action") from exc

    try:
        await _append_audit_jsonl(request.decision_id, record)
    except Exception:
        logger.exception("audit_jsonl.write_failed decision_id={}", request.decision_id)

    return {"status": "ok"}


@app.get("/audit/export")
async def export_audit(since: Optional[str] = Query(None, description="ISO-8601 timestamp; export only records after this moment")) -> dict:
    """
    Export all HITL audit records to the monthly JSONL file on disk and
    return the file path.  Idempotent: re-running overwrites the file.
    """
    try:
        rows = await db.get_all_audit_records(since=since)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc

    if not rows:
        return {"status": "ok", "records": 0, "path": None}

    _AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    out_path = _AUDIT_DIR / f"audit_{month}.jsonl"

    def _serialize(v):
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v) if v is not None else None

    mode = "a" if since else "w"
    with open(out_path, mode, encoding="utf-8") as fh:
        for row in rows:
            entry = {k: _serialize(v) if not isinstance(v, (str, int, float, bool, type(None))) else v for k, v in row.items()}
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")

    logger.info("audit_export.written records={} path={}", len(rows), out_path)
    return {"status": "ok", "records": len(rows), "path": str(out_path)}


@app.post("/demo/start")
async def start_demo(request: DemoStartRequest) -> dict:
    script = Path(__file__).parent.parent / "scripts" / "demo_runner.py"
    try:
        await asyncio.create_subprocess_exec(
            "python",
            str(script),
            "--bearing",        # demo_runner.py uses --bearing, not --bearing-id
            request.bearing_id,
            "--speed",
            str(request.speed),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not start demo runner") from exc
    return {"status": "started", "bearing_id": request.bearing_id}


@app.get("/metrics")
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


async def _snapshot_consumer_loop() -> None:
    """Supervisor loop: restart the Kafka consumer with exponential backoff on failure."""
    global _consumer_alive
    backoff = 1.0
    while True:
        try:
            _consumer_alive = True
            await messaging.consume_loop(
                topic=messaging.TOPIC_SNAPSHOTS,
                group_id="orchestrator",
                handler=_handle_snapshot_message,
            )
            # consume_loop returned normally (only on graceful shutdown)
            break
        except asyncio.CancelledError:
            _consumer_alive = False
            raise
        except Exception:
            _consumer_alive = False
            logger.exception(
                "Snapshot consumer crashed — restarting in %.0fs (backoff=%.0fs)",
                backoff, backoff,
            )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, _CONSUMER_MAX_BACKOFF)
    _consumer_alive = False


async def _handle_snapshot_message(raw: bytes) -> None:
    data = json.loads(raw)
    snapshot = SnapshotPayload(**data)
    bound_logger = logger.bind(bearing_id=snapshot.bearing_id)
    trace = create_trace(
        name=f"negotiation/{snapshot.bearing_id}",
        trace_id=snapshot.snapshot_id,
        input=data,
        metadata={
            "bearing_id": snapshot.bearing_id,
            "p_fail": snapshot.prediction.p_fail,
            "rul_minutes": snapshot.prediction.rul_minutes,
            "trigger_source": snapshot.trigger_source,
        },
    )
    bound_logger.info("snapshot.received")
    try:
        result = await _run_negotiate(snapshot, persist=True, trace=trace)
        trace.update(
            output={
                "recommended_action": result.recommended_action,
                "rounds_taken": result.rounds_taken,
                "safety_veto": result.safety_veto,
            }
        )
        bound_logger.info(f"snapshot.completed action={result.recommended_action} rounds={result.rounds_taken}")
    finally:
        flush_langfuse()


async def _run_negotiate(
    snapshot: SnapshotPayload,
    persist: bool = False,
    trace=None,
) -> NegotiationRecord:
    start = time.perf_counter()
    anomaly_triggers_total.labels(bearing_id=snapshot.bearing_id).inc()
    bound_logger = logger.bind(bearing_id=snapshot.bearing_id)

    gate_result = decision_gate(snapshot)
    bound_logger.info(f"gate.route routing={gate_result.routing} priority={gate_result.priority}")
    if gate_result.routing != "NEGOTIATE":
        result = _record_from_gate(snapshot, gate_result)
        _record_decision_metrics(result, f"gate_{gate_result.routing.lower()}")
        if persist:
            await _persist_result(snapshot, result)
        return result

    thresholds, agents_cfg = _load_configs()
    agents = [
        SafetyAgent(thresholds, agents_cfg["safety_agent"]),
        HealthAgent(thresholds, agents_cfg.get("health_agent", {})),
        ProductionAgent(thresholds, agents_cfg.get("production_agent", {})),
        CostAgent(thresholds, agents_cfg.get("cost_agent", {})),
    ]
    graph = build_negotiation_graph(
        agents,
        max_rounds=thresholds["negotiation"].get("max_round", 2),
    )
    # graph.invoke and the agent LLM calls are synchronous (blocking I/O).
    # Run in a thread so the asyncio event loop stays responsive for
    # health checks and Prometheus metrics while negotiation is in progress.
    state = await asyncio.to_thread(
        graph.invoke,
        {
            "snapshot": snapshot,
            "round_no": 1,
            "proposals": [],
            "critiques": [],
            "votes": [],
            "transcript": [],
            "agents": agents,
            "max_rounds": thresholds["negotiation"].get("max_round", 2),
            "trace": trace,
        },
    )
    result = state["final_result"]
    if result is None:
        raise RuntimeError("Negotiation graph completed without a result")

    negotiation_rounds.observe(result.rounds_taken)
    negotiation_duration_seconds.observe(time.perf_counter() - start)
    _record_decision_metrics(result, "negotiated")
    if persist:
        await _persist_result(snapshot, result)
    bound_logger.info(f"negotiation.completed action={result.recommended_action} rounds={result.rounds_taken}")
    return result


def _record_from_gate(snapshot: SnapshotPayload, gate_result: GateResult) -> NegotiationRecord:
    action_map = {
        "STOP": "STOP",
        "CONTINUE": "CONTINUE",
        "INSPECT": "INSPECT",
    }
    return NegotiationRecord(
        snapshot_id=snapshot.snapshot_id,
        recommended_action=action_map[gate_result.routing],
        recommended_confidence=1.0,
        priority=gate_result.priority,
        safety_veto=gate_result.safety_veto,
        reasoning_summary=gate_result.reason,
        rounds_taken=0,
        transcript=[],
    )


async def _persist_result(snapshot: SnapshotPayload, result: NegotiationRecord) -> None:
    # Do NOT swallow exceptions here.  consume_loop only commits the Kafka
    # offset after the handler returns successfully.  If we catch-and-log,
    # the message is acked even when the DB write failed, losing the decision
    # permanently.  Let the exception propagate; consume_loop will re-raise,
    # skip the commit, and the message will be redelivered on restart.
    snapshot_db_id = await db.get_snapshot_id_by_prediction_id(snapshot.prediction_id)
    if snapshot_db_id is None:
        snapshot_db_id = await db.insert_snapshot(snapshot)
    await db.insert_decision(snapshot_db_id, result)
    for entry in result.transcript:
        await db.insert_agent_transcript(entry.model_copy(update={"snapshot_id": snapshot_db_id}))


async def _append_audit_jsonl(decision_id: str, record: DecisionActionRecord) -> None:
    """Append one audit entry to the monthly JSONL file (append-only)."""
    decision_ctx = await db.get_decision_with_snapshot(decision_id)

    entry: dict = {
        "ts": record.submitted_at.isoformat(),
        "snapshot_id": str(decision_ctx["snapshot_id"]) if decision_ctx else None,
        "bearing_id": decision_ctx["bearing_label"] if decision_ctx else None,
        "agent_decision": decision_ctx["recommended_action"] if decision_ctx else None,
        "human_action": record.action.lower(),
        "human_decision": record.final_action if record.action == "OVERRIDE" else None,
        "reason": record.override_reason,
        "operator": record.actor_user_id,
        "actor_role": record.actor_role,
        "source": record.source,
    }

    _AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    month = record.submitted_at.strftime("%Y-%m")
    out_path = _AUDIT_DIR / f"audit_{month}.jsonl"

    def _write() -> None:
        with open(out_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")

    await asyncio.to_thread(_write)
    logger.debug("audit_jsonl.appended snapshot_id={} action={}", entry["snapshot_id"], entry["human_action"])


async def _update_override_rate_gauge() -> None:
    pool = await db.get_pool()
    row = await pool.fetchrow(
        """
        SELECT
            COUNT(*) FILTER (WHERE action = 'OVERRIDE') AS overrides,
            COUNT(*) AS total
        FROM decision_actions
        WHERE submitted_at > NOW() - INTERVAL '1 hour'
        """
    )
    total = row["total"] if row else 0
    override_rate.set((row["overrides"] / total) if total else 0.0)


def _record_decision_metrics(result: NegotiationRecord, routing: str) -> None:
    decisions_total.labels(action=result.recommended_action, routing=routing).inc()
    if result.safety_veto:
        safety_veto_total.inc()


def _load_configs() -> tuple[dict, dict]:
    with open(_CONFIG_DIR / "thresholds.yaml") as f:
        thresholds = yaml.safe_load(f)
    with open(_CONFIG_DIR / "agents.yaml") as f:
        agents = yaml.safe_load(f)
    return thresholds, agents
