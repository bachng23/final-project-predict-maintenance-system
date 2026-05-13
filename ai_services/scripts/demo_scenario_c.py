from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from orchestrator.agents.cost_agent import CostAgent
from orchestrator.agents.health_agent import HealthAgent
from orchestrator.agents.production_agent import ProductionAgent
from orchestrator.agents.safety_agent import SafetyAgent
from orchestrator.graph import build_negotiation_graph
from shared.schemas import PredictionRecord, SnapshotPayload

CONFIG_DIR = Path(__file__).resolve().parents[1] / "configs"


def _load_configs() -> tuple[dict, dict]:
    with open(CONFIG_DIR / "thresholds.yaml") as f:
        thresholds = yaml.safe_load(f) or {}
    with open(CONFIG_DIR / "agents.yaml") as f:
        agents = yaml.safe_load(f) or {}
    return thresholds, agents


def _snapshot() -> SnapshotPayload:
    prediction = PredictionRecord(
        bearing_id="demo-negotiate",
        file_idx=32,
        sample_ts=datetime.now(timezone.utc),
        rul_minutes=90.0,
        rul_lower_minutes=65.0,
        rul_upper_minutes=125.0,
        rul_uncertainty=0.025,
        p_fail=0.55,
        health_score=52.0,
        fault_type="OUTER_RACE",
        fault_confidence=0.78,
        hybrid_score=0.68,
        model_version="demo",
    )
    return SnapshotPayload(
        bearing_id="demo-negotiate",
        prediction_id="demo-pred-borderline",
        trigger_source="MANUAL_REQUEST",
        prediction=prediction,
        operation_context={"shift_remaining_hours": 2.0, "throughput_priority": 0.9},
        cost_context={"C_planned": 1200, "C_emergency": 11000, "C_inspect": 300},
        safety_context={"violated": []},
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args()
    thresholds, agents_cfg = _load_configs()
    agents = [
        HealthAgent(thresholds, agents_cfg.get("health_agent", {})),
        ProductionAgent(thresholds, agents_cfg.get("production_agent", {})),
        CostAgent(thresholds, agents_cfg.get("cost_agent", {})),
        SafetyAgent(thresholds, agents_cfg.get("safety_agent", {})),
    ]
    graph = build_negotiation_graph(agents, max_rounds=thresholds.get("negotiation", {}).get("max_round", 2))
    state = graph.invoke({"snapshot": _snapshot(), "agents": agents})
    result = state["final_result"]

    print("\n[Multi-agent Negotiation Demo]")
    current_round = None
    current_type = None
    for entry in result.transcript:
        if (entry.round_no, entry.message_type) != (current_round, current_type):
            current_round, current_type = entry.round_no, entry.message_type
            print(f"\nRound {current_round} - {current_type.title()}:")
        confidence = f"{entry.confidence:.2f}" if entry.confidence is not None else "n/a"
        action = entry.action_candidate or "NONE"
        print(f"  {entry.agent_name:<16} {action:<8} ({confidence}) - {entry.reasoning}")

    print("\nManager:")
    print(f"  Final: {result.recommended_action} (confidence={result.recommended_confidence:.2f})")
    print(f"  Summary: {result.reasoning_summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
