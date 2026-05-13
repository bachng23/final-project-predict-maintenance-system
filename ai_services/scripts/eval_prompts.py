from __future__ import annotations

import argparse
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from orchestrator.agents.cost_agent import CostAgent
from orchestrator.agents.health_agent import HealthAgent
from orchestrator.agents.production_agent import ProductionAgent
from predictor.inference import BearingContext, predict
from predictor.model_loader import load_all_models
from shared.schemas import AgentTranscriptEntry, FeatureRecord, SnapshotPayload
from signal_processor.feature_extractor import CONDITION_RPM, extract_features

LABELED_CASES = [
    ("Bearing2_4", "37.5Hz11kN", 5, "CONTINUE", "early_healthy"),
    ("Bearing2_4", "37.5Hz11kN", 10, "CONTINUE", "mid_healthy"),
    ("Bearing2_4", "37.5Hz11kN", 32, "INSPECT", "late_degradation"),
    ("Bearing2_4", "37.5Hz11kN", 38, "MAINTAIN", "near_failure"),
    ("Bearing2_4", "37.5Hz11kN", 41, "STOP", "imminent_failure"),
    ("Bearing2_5", "37.5Hz11kN", 44, "STOP", "imminent_failure"),
    ("Bearing3_1", "40Hz10kN", 5, "CONTINUE", "early_healthy"),
]

ACCEPTABLE = {
    "CONTINUE": {"CONTINUE"},
    "INSPECT": {"INSPECT", "MAINTAIN"},
    "MAINTAIN": {"MAINTAIN", "STOP", "INSPECT"},
    "STOP": {"STOP", "MAINTAIN"},
}

CONFIG_DIR = Path(__file__).resolve().parents[1] / "configs"


def _default_data_root() -> Path:
    repo_data = Path(__file__).resolve().parents[2] / "data" / "xjtu-sy"
    return repo_data if repo_data.exists() else Path("/data/xjtu-sy")


def _condition_id(condition_folder: str) -> int:
    return {"35Hz12kN": 1, "37.5Hz11kN": 2, "40Hz10kN": 3}[condition_folder]


def _load_csv_signal(csv_path: Path) -> np.ndarray:
    data = np.genfromtxt(csv_path, delimiter=",", dtype=np.float32, skip_header=1)
    return data.T


def _load_configs() -> tuple[dict, dict]:
    with open(CONFIG_DIR / "thresholds.yaml") as f:
        thresholds = yaml.safe_load(f) or {}
    with open(CONFIG_DIR / "agents.yaml") as f:
        agents = yaml.safe_load(f) or {}
    return thresholds, agents


def build_snapshot_from_file(
    data_root: Path,
    bearing_id: str,
    condition_folder: str,
    file_idx: int,
) -> SnapshotPayload:
    csv_path = data_root / condition_folder / bearing_id / f"{file_idx}.csv"
    signal_2ch = _load_csv_signal(csv_path)

    bearing_dir = csv_path.parent
    total_files = len(list(bearing_dir.glob("*.csv")))
    lifetime_pct = file_idx / total_files
    condition = _condition_id(condition_folder)
    rpm = CONDITION_RPM[condition]
    features = extract_features(signal_2ch, rpm=rpm)

    record = FeatureRecord(
        bearing_id=bearing_id,
        file_idx=file_idx,
        sample_ts=datetime.now(timezone.utc),
        lifetime_pct=lifetime_pct,
        features=features,
    )
    load_kn = 11.0 if condition == 2 else (12.0 if condition == 1 else 10.0)
    prediction = predict(record, BearingContext(rpm=rpm, load_kn=load_kn, elapsed_minutes=file_idx * 1.0))
    prediction.hybrid_score = prediction.p_fail

    return SnapshotPayload(
        bearing_id=bearing_id,
        prediction_id="eval-mode",
        trigger_source="MANUAL_REQUEST",
        prediction=prediction,
        operation_context={"shift_remaining_hours": 4.0, "throughput_priority": 0.5},
        cost_context={
            "C_planned": 1200,
            "C_emergency": 11000,
            "C_inspect": 300,
            "c_planned_maintenance": 1200,
            "c_emergency_repair": 11000,
            "c_inspection": 300,
        },
        safety_context={"violated": []},
    )


def score_agent(proposals: list[AgentTranscriptEntry], expected: str) -> float:
    actions = [p.action_candidate for p in proposals if p.action_candidate]
    if not actions:
        return 0.0
    majority, _ = Counter(actions).most_common(1)[0]
    return 1.0 if majority in ACCEPTABLE[expected] else 0.0


def _mark(action: str | None, expected: str) -> str:
    return "OK" if action in ACCEPTABLE[expected] else "MISS"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, default=_default_data_root())
    args = parser.parse_args()

    load_all_models()
    thresholds, agents_cfg = _load_configs()
    agents = [
        HealthAgent(thresholds, agents_cfg.get("health_agent", {})),
        ProductionAgent(thresholds, agents_cfg.get("production_agent", {})),
        CostAgent(thresholds, agents_cfg.get("cost_agent", {})),
    ]

    totals: dict[str, list[float]] = defaultdict(list)
    width = 54
    print("─" * width)
    print(f"Prompt Evaluation - {len(LABELED_CASES)} test cases")
    print("─" * width)

    for bearing_id, condition_folder, file_idx, expected, label in LABELED_CASES:
        print(f"Case: {bearing_id} file={file_idx:<3} label={label:<18} expected={expected}")
        try:
            snapshot = build_snapshot_from_file(args.data_root, bearing_id, condition_folder, file_idx)
        except Exception as exc:
            print(f"  build_snapshot: FAILED - {exc}")
            for agent in agents:
                totals[agent.name].append(0.0)
            continue

        for agent in agents:
            try:
                entries = [agent.propose(snapshot, 1), agent.vote(snapshot, 1, [])]
            except Exception as exc:
                print(f"  {agent.name:<16} ERROR ({exc})")
                totals[agent.name].append(0.0)
                continue
            score = score_agent(entries, expected)
            totals[agent.name].append(score)
            action = Counter([e.action_candidate for e in entries if e.action_candidate]).most_common(1)[0][0]
            confidence = max((e.confidence or 0.0) for e in entries)
            print(f"  {agent.name:<16} {action:<8} ({confidence:.2f}) {_mark(action, expected)}")
        print()

    print("─" * width)
    needs_tuning = False
    for agent_name, scores in totals.items():
        passed = int(sum(scores))
        pct = 100.0 * passed / len(scores) if scores else 0.0
        print(f"{agent_name:<16} alignment: {passed}/{len(scores)} ({pct:.1f}%)")
        needs_tuning = needs_tuning or pct < 70.0
    print("─" * width)
    if needs_tuning:
        print("PROMPT NEEDS TUNING")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
