from datetime import datetime, timezone

from orchestrator.agents.base import BaseAgent
from orchestrator.agents.cost_agent import CostAgent
from orchestrator.agents.health_agent import HealthAgent
from orchestrator.agents.llm_utils import FallbackLLM, LLMProvider, llm_entry
from orchestrator.agents.production_agent import ProductionAgent
from shared.schemas import PredictionRecord, SnapshotPayload


class BadLLM:
    def invoke(self, prompt: str):
        return type("Response", (), {"content": "not json"})()


class FailingLLM:
    def invoke(self, prompt: str):
        raise RuntimeError("provider down")


class GoodLLM:
    def invoke(self, prompt: str):
        return type(
            "Response",
            (),
            {"content": '{"action": "MAINTAIN", "confidence": 0.82, "reasoning": "OpenRouter fallback succeeded."}'},
        )()


def make_snapshot() -> SnapshotPayload:
    prediction = PredictionRecord(
        bearing_id="bearing-1",
        file_idx=1,
        sample_ts=datetime.now(timezone.utc),
        rul_minutes=90.0,
        rul_lower_minutes=60.0,
        rul_upper_minutes=120.0,
        rul_uncertainty=0.02,
        p_fail=0.55,
        health_score=42.0,
        fault_type="UNKNOWN",
        fault_confidence=0.2,
        hybrid_score=0.65,
        model_version="test-v0",
    )
    return SnapshotPayload(
        bearing_id="bearing-1",
        prediction_id="prediction-1",
        trigger_source="ANOMALY_TRIGGER",
        prediction=prediction,
    )


def test_llm_agents_import_and_extend_base_agent():
    assert issubclass(HealthAgent, BaseAgent)
    assert issubclass(ProductionAgent, BaseAgent)
    assert issubclass(CostAgent, BaseAgent)


def test_llm_agents_fallback_to_inspect_on_bad_json():
    snapshot = make_snapshot()
    for agent_cls in (HealthAgent, ProductionAgent, CostAgent):
        agent = agent_cls()
        agent._llm = BadLLM()

        proposal = agent.propose(snapshot, round_no=1)

        assert proposal.action_candidate == "INSPECT"
        assert proposal.confidence == 0.5


def test_llm_entry_uses_openrouter_when_ollama_fails():
    llm = FallbackLLM(
        [
            LLMProvider(name="ollama", client=FailingLLM()),
            LLMProvider(name="openrouter", client=GoodLLM()),
        ]
    )

    entry = llm_entry(
        llm=llm,
        prompt="Return JSON",
        snapshot_id="snapshot-1",
        round_no=1,
        agent_name="health_agent",
        message_type="PROPOSE",
        method="propose",
    )

    assert llm.provider_names == ["ollama", "openrouter"]
    assert entry.action_candidate == "MAINTAIN"
    assert entry.confidence == 0.82


def test_prompt_files_are_not_blank():
    prompt_dir = __import__("pathlib").Path("orchestrator/prompts")
    for name in ("health.txt", "production.txt", "cost.txt", "manager.txt"):
        assert (prompt_dir / name).read_text().strip()
