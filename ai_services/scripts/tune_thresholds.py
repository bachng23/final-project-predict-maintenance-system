from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from anomaly.anomaly_detector import AnomalyConfig, AnomalyDetector

GRID = {
    "tau": [0.50, 0.55, 0.60, 0.65, 0.70],
    "K_consecutive": [2, 3, 4],
    "cooldown": [3, 5, 7],
}

THRESHOLDS_PATH = Path(__file__).resolve().parents[1] / "configs" / "thresholds.yaml"


def _default_data_root() -> Path:
    repo_data = Path(__file__).resolve().parents[2] / "data" / "xjtu-sy"
    return repo_data if repo_data.exists() else Path("/data/xjtu-sy")


def _load_csv_signal(path: Path) -> tuple[np.ndarray, np.ndarray]:
    data = np.genfromtxt(path, delimiter=",", dtype=np.float32, skip_header=1)
    return data[:, 0], data[:, 1]


def load_thresholds() -> dict:
    with open(THRESHOLDS_PATH) as f:
        return yaml.safe_load(f) or {}


def evaluate_config(
    tau: float,
    k_consecutive: int,
    cooldown: int,
    bearing_id: str,
    condition_folder: str,
    data_root: Path,
) -> dict:
    baseline = load_thresholds().get("healthy_baseline", {})
    cfg = AnomalyConfig(
        tau=tau,
        K_consecutive=k_consecutive,
        cooldown_cycles=cooldown,
        rms_mean=baseline.get("rms_mean", 0.0),
        rms_std=baseline.get("rms_std", 1.0),
        kurt_mean=baseline.get("kurt_mean", 3.0),
        kurt_std=baseline.get("kurt_std", 1.0),
    )
    detector = AnomalyDetector(cfg)
    bearing_dir = data_root / condition_folder / bearing_id
    csv_files = sorted(bearing_dir.glob("*.csv"), key=lambda p: int(p.stem))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files in {bearing_dir}")

    triggers: list[int] = []
    for i, csv_path in enumerate(csv_files, start=1):
        h_sig, _ = _load_csv_signal(csv_path)
        rms_val = float(np.sqrt(np.mean(h_sig ** 2)))
        p_fail_mock = max(0.0, (i / len(csv_files)) ** 2)
        rul_mock = (len(csv_files) - i) * 1.0
        if detector.update(bearing_id, i, p_fail_mock, rms_val, rul_mock):
            triggers.append(i)

    first_trigger = triggers[0] if triggers else None
    false_triggers = [idx for idx in triggers if idx <= 20]
    missed = first_trigger is None or first_trigger > 40
    score = 0 if missed else (1 if 28 <= first_trigger <= 40 else 0) - len(false_triggers)
    return {
        "tau": tau,
        "K": k_consecutive,
        "cooldown": cooldown,
        "first_trigger": first_trigger,
        "false_triggers_count": len(false_triggers),
        "missed": missed,
        "score": score,
    }


def apply_recommendation(result: dict) -> None:
    cfg = load_thresholds()
    anomaly = cfg.setdefault("anomaly", {})
    anomaly["tau"] = float(result["tau"])
    anomaly["K_consecutive"] = int(result["K"])
    anomaly["cooldown_cycles"] = int(result["cooldown"])
    with open(THRESHOLDS_PATH, "w") as f:
        yaml.dump(cfg, f, default_flow_style=False, sort_keys=False)


def _rank_key(result: dict) -> tuple:
    first = result["first_trigger"] if result["first_trigger"] is not None else 999
    return (
        result["score"],
        -result["false_triggers_count"],
        result["K"] == 3,
        result["cooldown"] == 5,
        -abs(result["tau"] - 0.55),
        -abs(first - 33),
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bearing", default="Bearing2_4")
    parser.add_argument("--condition-folder", default="37.5Hz11kN")
    parser.add_argument("--data-root", type=Path, default=_default_data_root())
    parser.add_argument("--no-apply", action="store_true")
    args = parser.parse_args()

    results = [
        evaluate_config(tau, k, cooldown, args.bearing, args.condition_folder, args.data_root)
        for tau in GRID["tau"]
        for k in GRID["K_consecutive"]
        for cooldown in GRID["cooldown"]
    ]
    results.sort(key=_rank_key, reverse=True)
    best = results[0]

    print("─" * 61)
    print(f"Threshold Grid Search - {args.bearing}")
    print("─" * 61)
    print("tau   K  cooldown  first_trigger  false_triggers  score")
    for row in results:
        first = row["first_trigger"] if row["first_trigger"] is not None else "None"
        false = row["false_triggers_count"] if row["first_trigger"] is not None else "--"
        print(f"{row['tau']:<5.2f} {row['K']:<2} {row['cooldown']:^8} {str(first):^13} {str(false):^15} {row['score']:>5}")
    print("─" * 61)
    print(f"Recommended: tau={best['tau']:.2f}, K={best['K']}, cooldown={best['cooldown']}")
    if not args.no_apply:
        apply_recommendation(best)
        print(f"Applied to {THRESHOLDS_PATH}")
    return 0 if best["score"] >= 1 else 1


if __name__ == "__main__":
    raise SystemExit(main())
