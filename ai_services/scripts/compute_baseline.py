"""
One-time script: compute healthy baseline stats from XJTU-SY training bearings.
Reads the first 10% of files (healthy phase) per bearing → writes configs/thresholds.yaml.

Usage:
    uv run python scripts/compute_baseline.py
    uv run python scripts/compute_baseline.py --bearings Bearing1_1 Bearing1_2
"""
from __future__ import annotations

import argparse
import logging
import math
from pathlib import Path

import numpy as np
import yaml

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Default training bearings from model_card.json
DEFAULT_TRAIN_BEARINGS = [
    "Bearing1_1", "Bearing1_2",
    "Bearing2_2", "Bearing2_3",
    "Bearing3_2", "Bearing3_5",
]

THRESHOLDS_PATH = Path(__file__).parent.parent / "configs" / "thresholds.yaml"
DATA_ROOT = Path("/data/xjtu-sy")

_CONDITION_FOLDER = {
    "1": "35Hz12kN",
    "2": "37.5Hz11kN",
    "3": "40Hz10kN",
}


def _load_csv_signal(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Return (h_signal, v_signal) as float32 arrays from XJTU-SY CSV."""
    data = np.loadtxt(path, delimiter=",", skiprows=1, dtype=np.float32)
    return data[:, 0], data[:, 1]


def _rms(signal: np.ndarray) -> float:
    return float(np.sqrt(np.mean(signal ** 2)))


def _kurtosis(signal: np.ndarray) -> float:
    mu = signal.mean()
    std = signal.std()
    if std < 1e-9:
        return 0.0
    return float(np.mean(((signal - mu) / std) ** 4))


def compute_baseline(bearings: list[str], data_root: Path) -> dict:
    rms_vals, kurt_vals = [], []

    for bearing_id in bearings:
        cond = bearing_id.replace("Bearing", "").replace("bearing", "").split("_")[0]
        condition_folder = _CONDITION_FOLDER.get(cond)
        bearing_dir = data_root / condition_folder / bearing_id if condition_folder else data_root / bearing_id
        if not bearing_dir.exists():
            bearing_dir = data_root / bearing_id
        if not bearing_dir.exists():
            log.warning("Bearing dir not found: %s — skipping", bearing_dir)
            continue

        csv_files = sorted(bearing_dir.glob("*.csv"), key=lambda p: int(p.stem))
        if not csv_files:
            log.warning("No CSV files in %s — skipping", bearing_dir)
            continue

        # Use first 10% of files as healthy phase
        n_healthy = max(1, math.ceil(len(csv_files) * 0.10))
        healthy_files = csv_files[:n_healthy]
        log.info("%s: %d total files, using first %d as healthy", bearing_id, len(csv_files), n_healthy)

        for csv_path in healthy_files:
            h_sig, _ = _load_csv_signal(csv_path)
            # Use horizontal channel (h) as primary, consistent with feature_extractor
            rms_vals.append(_rms(h_sig))
            kurt_vals.append(_kurtosis(h_sig))

    if not rms_vals:
        raise RuntimeError("No data loaded — check DATA_ROOT path and bearing names")

    rms_arr  = np.array(rms_vals)
    kurt_arr = np.array(kurt_vals)

    baseline = {
        "rms_mean":  float(rms_arr.mean()),
        "rms_std":   float(rms_arr.std()),
        "kurt_mean": float(kurt_arr.mean()),
        "kurt_std":  float(kurt_arr.std()),
    }
    log.info(
        "Baseline computed from %d samples: rms=%.4f±%.4f  kurtosis=%.4f±%.4f",
        len(rms_vals),
        baseline["rms_mean"], baseline["rms_std"],
        baseline["kurt_mean"], baseline["kurt_std"],
    )
    return baseline


def write_thresholds(baseline: dict) -> None:
    existing: dict = {}
    if THRESHOLDS_PATH.exists():
        with open(THRESHOLDS_PATH) as f:
            existing = yaml.safe_load(f) or {}

    existing["healthy_baseline"] = baseline

    # Write only if not already present (preserve manual edits to other sections)
    if "anomaly" not in existing:
        existing["anomaly"] = {
            "tau":               0.60,
            "K_consecutive":     3,
            "cooldown_cycles":   5,
            "delta_escalation":  0.15,
        }
    if "safety" not in existing:
        existing["safety"] = {
            "vibration_redline_g": 20.0,
            "crest_factor_redline": 6.0,
        }

    with open(THRESHOLDS_PATH, "w") as f:
        yaml.dump(existing, f, default_flow_style=False, sort_keys=False)
    log.info("Written to %s", THRESHOLDS_PATH)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bearings", nargs="+", default=DEFAULT_TRAIN_BEARINGS)
    parser.add_argument("--data-root", type=Path, default=DATA_ROOT)
    args = parser.parse_args()

    baseline = compute_baseline(args.bearings, args.data_root)
    write_thresholds(baseline)


if __name__ == "__main__":
    main()
