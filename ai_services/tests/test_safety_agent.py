from datetime import datetime, timezone

import yaml

from orchestrator.agents.safety_agent import SafetyAgent
from shared.schemas import AgentTranscriptEntry, PredictionRecord, SnapshotPayload


def make_snapshot(
    *,
    p_fail: float = 0.20,
    rul_minutes: float = 120.0,
    health_score: float = 80.0,
    safety_context: dict | None = None,
) -> SnapshotPayload:
    prediction = PredictionRecord(
        bearing_id="bearing-1",
        file_idx=1,
        sample_ts=datetime.now(timezone.utc),
        rul_minutes=rul_minutes,
        rul_uncertainty=0.02,
        p_fail=p_fail,
        health_score=health_score,
        model_version="test-v0",
    )
    return SnapshotPayload(
        bearing_id="bearing-1",
        prediction_id="prediction-1",
        trigger_source="ANOMALY_TRIGGER",
        prediction=prediction,
        safety_context=safety_context or {},
    )


def make_agent() -> SafetyAgent:
    with open("configs/thresholds.yaml") as f:
        thresholds = yaml.safe_load(f)
    with open("configs/agents.yaml") as f:
        agents = yaml.safe_load(f)
    return SafetyAgent(thresholds=thresholds, agent_cfg=agents["safety_agent"])


def test_safety_agent_imports():
    from orchestrator.agents.safety_agent import SafetyAgent as ImportedSafetyAgent

    assert ImportedSafetyAgent.name == "safety_agent"


def test_safety_agent_proposes_stop_for_safety_context_violations():
    agent = make_agent()

    proposal = agent.propose(
        make_snapshot(safety_context={"violated": ["vibration_rms_h"]}),
        round_no=1,
    )

    assert proposal.action_candidate == "STOP"
    assert proposal.confidence == 1.0


def test_safety_agent_proposes_stop_for_high_p_fail():
    agent = make_agent()

    proposal = agent.propose(make_snapshot(p_fail=0.85), round_no=1)

    assert proposal.action_candidate == "STOP"
    assert proposal.confidence == 1.0


def test_safety_agent_vote_keeps_own_proposal_after_critiques():
    agent = make_agent()
    snapshot = make_snapshot(p_fail=0.85)
    proposal = agent.propose(snapshot, round_no=1)
    critique = AgentTranscriptEntry(
        snapshot_id=snapshot.snapshot_id,
        round_no=1,
        agent_name="production_agent",
        message_type="CRITIQUE",
        action_candidate="CONTINUE",
        confidence=0.9,
        reasoning="Production prefers continuing.",
    )

    vote = agent.vote(snapshot, round_no=2, all_critiques=[critique])

    assert vote.action_candidate == proposal.action_candidate
    assert vote.confidence == proposal.confidence
