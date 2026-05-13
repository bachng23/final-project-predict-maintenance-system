from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import orchestrator.app as orchestrator_app
from orchestrator.app import _run_negotiate
from orchestrator.graph import build_negotiation_graph
from shared.schemas import AgentTranscriptEntry, PredictionRecord, SnapshotPayload


def make_snapshot(
    *,
    p_fail: float = 0.55,
    rul_uncertainty: float | None = 0.02,
) -> SnapshotPayload:
    prediction = PredictionRecord(
        bearing_id="bearing-1",
        file_idx=1,
        sample_ts=datetime.now(timezone.utc),
        rul_minutes=90.0,
        rul_uncertainty=rul_uncertainty,
        p_fail=p_fail,
        health_score=50.0,
        model_version="test-v0",
    )
    return SnapshotPayload(
        bearing_id="bearing-1",
        prediction_id="prediction-1",
        trigger_source="ANOMALY_TRIGGER",
        prediction=prediction,
    )


class LowConfidenceAgent:
    name = "low_confidence_agent"

    def propose(self, snapshot, round_no):
        return self._entry(snapshot, round_no, "PROPOSE")

    def critique(self, snapshot, round_no, other_proposals):
        return self._entry(snapshot, round_no, "CRITIQUE")

    def vote(self, snapshot, round_no, all_critiques):
        return self._entry(snapshot, round_no, "VOTE")

    def _entry(self, snapshot, round_no, message_type):
        return AgentTranscriptEntry(
            snapshot_id=snapshot.snapshot_id,
            round_no=round_no,
            agent_name=self.name,
            message_type=message_type,
            action_candidate="CONTINUE",
            confidence=0.1,
            reasoning="Low confidence test vote.",
        )


def test_negotiation_graph_fallback_after_max_rounds():
    graph = build_negotiation_graph(
        agents=[LowConfidenceAgent()],
        max_rounds=1,
        confidence_threshold=1.1,
    )

    state = graph.invoke({"snapshot": make_snapshot(), "round_no": 1})

    assert state["final_result"].recommended_action == "INSPECT"
    assert state["final_result"].recommended_confidence == 0.5


@pytest.mark.anyio
async def test_run_negotiate_safety_veto_short_circuits_graph():
    result = await _run_negotiate(make_snapshot(p_fail=0.90), persist=False)

    assert result.recommended_action == "STOP"
    assert result.safety_veto is True
    assert result.transcript == []


@pytest.mark.anyio
async def test_run_negotiate_full_case_returns_record():
    result = await _run_negotiate(make_snapshot(p_fail=0.55), persist=False)

    assert result.recommended_action in {"CONTINUE", "INSPECT", "MAINTAIN", "STOP"}
    assert result.rounds_taken <= 2
    assert len(result.transcript) == 12


def test_post_negotiate_and_metrics_endpoint(monkeypatch):
    async def noop_persist(snapshot, result):
        return None

    monkeypatch.setattr(orchestrator_app, "_persist_result", noop_persist)
    client = TestClient(orchestrator_app.app)

    response = client.post("/negotiate", json=make_snapshot(p_fail=0.90).model_dump(mode="json"))
    metrics_response = client.get("/metrics")

    assert response.status_code == 200
    assert response.json()["recommended_action"] == "STOP"
    assert "pdm_decisions_total" in metrics_response.text


@pytest.mark.anyio
async def test_persist_result_reuses_existing_snapshot(monkeypatch):
    snapshot = make_snapshot(p_fail=0.55)
    result = await _run_negotiate(snapshot, persist=False)
    calls = {"insert_snapshot": 0, "decision_snapshot_id": None, "transcript_ids": []}

    async def existing_snapshot_id(prediction_id):
        assert prediction_id == snapshot.prediction_id
        return "db-snapshot-1"

    async def insert_snapshot(unused_snapshot):
        calls["insert_snapshot"] += 1
        return "new-snapshot"

    async def insert_decision(snapshot_id, unused_result):
        calls["decision_snapshot_id"] = snapshot_id
        return "decision-1"

    async def insert_agent_transcript(entry):
        calls["transcript_ids"].append(entry.snapshot_id)

    monkeypatch.setattr(orchestrator_app.db, "get_snapshot_id_by_prediction_id", existing_snapshot_id)
    monkeypatch.setattr(orchestrator_app.db, "insert_snapshot", insert_snapshot)
    monkeypatch.setattr(orchestrator_app.db, "insert_decision", insert_decision)
    monkeypatch.setattr(orchestrator_app.db, "insert_agent_transcript", insert_agent_transcript)

    await orchestrator_app._persist_result(snapshot, result)

    assert calls["insert_snapshot"] == 0
    assert calls["decision_snapshot_id"] == "db-snapshot-1"
    assert all(snapshot_id == "db-snapshot-1" for snapshot_id in calls["transcript_ids"])
