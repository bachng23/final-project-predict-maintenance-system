from __future__ import annotations

from datetime import datetime, timezone

import yaml

from orchestrator.agents.base import BaseAgent
from orchestrator.agents.safety_agent import SafetyAgent
from orchestrator.graph import build_negotiation_graph
from shared.schemas import AgentTranscriptEntry, PredictionRecord, SnapshotPayload


class StubAgent(BaseAgent):
    """Agent giả trả hardcoded action - không gọi LLM."""

    name = "stub_agent"

    def __init__(self, action: str, confidence: float, name: str | None = None):
        self._action = action
        self._confidence = confidence
        if name:
            self.name = name

    def propose(self, snapshot, round_no) -> AgentTranscriptEntry:
        return AgentTranscriptEntry(
            snapshot_id=snapshot.snapshot_id,
            round_no=round_no,
            agent_name=self.name,
            message_type="PROPOSE",
            action_candidate=self._action,
            confidence=self._confidence,
            reasoning=f"Stub: always {self._action}",
        )

    def critique(self, snapshot, round_no, other_proposals):
        return AgentTranscriptEntry(
            snapshot_id=snapshot.snapshot_id,
            round_no=round_no,
            agent_name=self.name,
            message_type="CRITIQUE",
            action_candidate=self._action,
            confidence=self._confidence,
            reasoning="No objection.",
        )

    def vote(self, snapshot, round_no, all_critiques):
        return AgentTranscriptEntry(
            snapshot_id=snapshot.snapshot_id,
            round_no=round_no,
            agent_name=self.name,
            message_type="VOTE",
            action_candidate=self._action,
            confidence=self._confidence,
            reasoning="Vote unchanged.",
        )


def load_thresholds() -> dict:
    with open("configs/thresholds.yaml") as f:
        return yaml.safe_load(f)


def load_agent_cfg() -> dict:
    with open("configs/agents.yaml") as f:
        return yaml.safe_load(f)


def make_snapshot(*, p_fail: float = 0.60) -> SnapshotPayload:
    prediction = PredictionRecord(
        bearing_id="Bearing2_4",
        file_idx=32,
        sample_ts=datetime.now(timezone.utc),
        rul_minutes=80.0,
        rul_uncertainty=0.02,
        p_fail=p_fail,
        health_score=45.0,
        model_version="test-v0",
    )
    return SnapshotPayload(
        bearing_id="Bearing2_4",
        prediction_id="prediction-1",
        trigger_source="ANOMALY_TRIGGER",
        prediction=prediction,
    )


def test_graph_converges_when_all_agents_agree():
    agents = [StubAgent("MAINTAIN", 0.85, name=f"stub_{idx}") for idx in range(4)]
    graph = build_negotiation_graph(agents, max_rounds=2)

    result = graph.invoke({"snapshot": make_snapshot(p_fail=0.60), "round_no": 1, "agents": agents})

    assert result["final_result"].recommended_action == "MAINTAIN"
    assert result["final_result"].rounds_taken == 1


def test_graph_fallback_after_max_rounds():
    agents = [
        StubAgent("STOP", 0.51, name="stub_stop_1"),
        StubAgent("CONTINUE", 0.51, name="stub_continue_1"),
        StubAgent("STOP", 0.51, name="stub_stop_2"),
        StubAgent("CONTINUE", 0.51, name="stub_continue_2"),
    ]
    graph = build_negotiation_graph(agents, max_rounds=2)

    result = graph.invoke({"snapshot": make_snapshot(), "round_no": 1, "agents": agents})

    assert result["final_result"].recommended_action == "INSPECT"
    assert result["final_result"].rounds_taken == 2


def test_graph_transcript_accumulates_all_turns():
    agents = [StubAgent("INSPECT", 0.90, name=f"stub_{idx}") for idx in range(4)]
    graph = build_negotiation_graph(agents, max_rounds=2)

    result = graph.invoke({"snapshot": make_snapshot(), "round_no": 1, "agents": agents})
    transcript = result["final_result"].transcript

    assert len(transcript) >= 12


def test_graph_safety_agent_overrides_other_votes():
    safety = SafetyAgent(thresholds=load_thresholds(), agent_cfg=load_agent_cfg()["safety_agent"])
    others = [StubAgent("CONTINUE", 0.80, name=f"stub_continue_{idx}") for idx in range(3)]
    agents = [safety] + others
    graph = build_negotiation_graph(agents, max_rounds=2)

    result = graph.invoke({"snapshot": make_snapshot(p_fail=0.90), "round_no": 1, "agents": agents})

    assert result["final_result"].recommended_action in ("STOP", "INSPECT")
    assert result["final_result"].recommended_action != "CONTINUE"
