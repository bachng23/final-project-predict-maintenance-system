from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import yaml

from orchestrator.agents.cost_agent import CostAgent
from orchestrator.agents.health_agent import HealthAgent
from orchestrator.agents.production_agent import ProductionAgent
from shared.schemas import AgentTranscriptEntry, PredictionRecord, SnapshotPayload


def _make_llm_response(action: str, confidence: float, reasoning: str) -> MagicMock:
    msg = MagicMock()
    msg.content = json.dumps(
        {
            "action": action,
            "confidence": confidence,
            "reasoning": reasoning,
        }
    )
    return msg


def load_thresholds() -> dict:
    with open("configs/thresholds.yaml") as f:
        return yaml.safe_load(f)


def load_agent_cfg() -> dict:
    with open("configs/agents.yaml") as f:
        return yaml.safe_load(f)


def make_snapshot(
    *,
    p_fail: float = 0.55,
    operation_context: dict | None = None,
    cost_context: dict | None = None,
) -> SnapshotPayload:
    prediction = PredictionRecord(
        bearing_id="Bearing2_4",
        file_idx=32,
        sample_ts=datetime.now(timezone.utc),
        rul_minutes=80.0,
        rul_lower_minutes=50.0,
        rul_upper_minutes=120.0,
        rul_uncertainty=0.02,
        p_fail=p_fail,
        health_score=45.0,
        fault_type="OUTER_RACE",
        fault_confidence=0.75,
        hybrid_score=0.71,
        model_version="test-v0",
    )
    return SnapshotPayload(
        bearing_id="Bearing2_4",
        prediction_id="prediction-1",
        trigger_source="ANOMALY_TRIGGER",
        prediction=prediction,
        operation_context=operation_context or {},
        cost_context=cost_context or {},
    )


@patch("orchestrator.agents.health_agent.make_llm")
def test_health_propose_inspect(mock_make_llm):
    mock_llm = MagicMock()
    mock_make_llm.return_value = mock_llm
    mock_llm.invoke.return_value = _make_llm_response("INSPECT", 0.75, "RUL is low.")

    agent = HealthAgent(thresholds=load_thresholds(), agent_cfg=load_agent_cfg()["health_agent"])
    result = agent.propose(make_snapshot(p_fail=0.55), round_no=1)

    assert result.action_candidate == "INSPECT"
    assert result.confidence == 0.75
    assert result.agent_name == "health_agent"
    assert result.message_type == "PROPOSE"


@patch("orchestrator.agents.production_agent.make_llm")
def test_production_propose_continue(mock_make_llm):
    mock_llm = MagicMock()
    mock_make_llm.return_value = mock_llm
    mock_llm.invoke.return_value = _make_llm_response("CONTINUE", 0.80, "Stable enough.")

    agent = ProductionAgent(thresholds=load_thresholds(), agent_cfg=load_agent_cfg()["production_agent"])
    result = agent.propose(make_snapshot(p_fail=0.35), round_no=1)

    assert result.action_candidate == "CONTINUE"
    assert result.confidence == 0.80


@patch("orchestrator.agents.cost_agent.make_llm")
def test_cost_propose_includes_expected_costs(mock_make_llm):
    mock_llm = MagicMock()
    mock_make_llm.return_value = mock_llm
    mock_llm.invoke.return_value = _make_llm_response("STOP", 0.90, "expected_cost favors stopping")

    agent = CostAgent(thresholds=load_thresholds(), agent_cfg=load_agent_cfg()["cost_agent"])
    result = agent.propose(make_snapshot(p_fail=0.65), round_no=1)

    assert result.action_candidate == "STOP"
    assert result.confidence == 0.90
    assert "expected_cost" in result.reasoning


@patch("orchestrator.agents.health_agent.make_llm")
def test_health_critique_returns_transcript_entry(mock_make_llm):
    mock_llm = MagicMock()
    mock_make_llm.return_value = mock_llm
    mock_llm.invoke.return_value = _make_llm_response("INSPECT", 0.65, "Critique: risk understated.")
    snapshot = make_snapshot()
    other = AgentTranscriptEntry(
        snapshot_id=snapshot.snapshot_id,
        round_no=1,
        agent_name="production_agent",
        message_type="PROPOSE",
        action_candidate="CONTINUE",
        confidence=0.8,
        reasoning="Production prefers continuing.",
    )

    agent = HealthAgent(thresholds=load_thresholds(), agent_cfg=load_agent_cfg()["health_agent"])
    result = agent.critique(snapshot, round_no=1, other_proposals=[other])

    assert result.message_type == "CRITIQUE"
    assert result.agent_name == "health_agent"


@patch("orchestrator.agents.health_agent.make_llm")
def test_health_vote_after_critiques(mock_make_llm):
    mock_llm = MagicMock()
    mock_make_llm.return_value = mock_llm
    mock_llm.invoke.return_value = _make_llm_response("INSPECT", 0.70, "Vote remains inspect.")

    agent = HealthAgent(thresholds=load_thresholds(), agent_cfg=load_agent_cfg()["health_agent"])
    result = agent.vote(make_snapshot(), round_no=1, all_critiques=[])

    assert result.action_candidate == "INSPECT"
    assert result.confidence == 0.70
    assert result.message_type == "VOTE"


@patch("orchestrator.agents.health_agent.make_llm")
def test_health_agent_falls_back_to_inspect_on_json_error(mock_make_llm):
    mock_llm = MagicMock()
    mock_make_llm.return_value = mock_llm
    mock_llm.invoke.side_effect = Exception("Connection refused")

    agent = HealthAgent(thresholds=load_thresholds(), agent_cfg=load_agent_cfg()["health_agent"])
    result = agent.propose(make_snapshot(p_fail=0.55), round_no=1)

    assert result.action_candidate == "INSPECT"
    assert result.confidence == 0.5
    assert "error" in result.reasoning.lower()


@patch("orchestrator.agents.cost_agent.make_llm")
def test_cost_agent_falls_back_on_malformed_json(mock_make_llm):
    mock_llm = MagicMock()
    mock_make_llm.return_value = mock_llm
    bad_msg = MagicMock()
    bad_msg.content = "Sorry, I cannot help with that."
    mock_llm.invoke.return_value = bad_msg

    agent = CostAgent(thresholds=load_thresholds(), agent_cfg=load_agent_cfg()["cost_agent"])
    result = agent.propose(make_snapshot(p_fail=0.40), round_no=1)

    assert result.action_candidate == "INSPECT"
    assert result.confidence == 0.5


@patch("orchestrator.agents.production_agent.make_llm")
def test_production_agent_uses_operation_context_in_prompt(mock_make_llm):
    mock_llm = MagicMock()
    mock_make_llm.return_value = mock_llm
    mock_llm.invoke.return_value = _make_llm_response("CONTINUE", 0.70, "Near shift end.")
    snapshot = make_snapshot(
        p_fail=0.35,
        operation_context={
            "shift_remaining_hours": 0.5,
            "throughput_priority": 1.0,
        },
    )

    agent = ProductionAgent(thresholds=load_thresholds(), agent_cfg=load_agent_cfg()["production_agent"])
    agent.propose(snapshot, round_no=1)

    prompt_text = str(mock_llm.invoke.call_args)
    assert "0.5" in prompt_text or "shift" in prompt_text
