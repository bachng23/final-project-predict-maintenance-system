from __future__ import annotations

import math
import logging
from collections import deque
from typing import Optional

import numpy as np
import torch

from shared.schemas import FeatureRecord, PredictionRecord
import predictor.model_loader as ml

log = logging.getLogger(__name__)

# Per-bearing sliding window: bearing_id → deque of HI history dicts
# Each entry: {"hi_raw": float, "ts_minutes": float, "rpm": int, "load_kn": float}
_hi_history: dict[str, deque] = {}
SEQ_LEN = 30
MAX_HISTORY_BEARINGS = 50
HISTORY_EVICT_COUNT = 10


def _cleanup_hi_history() -> None:
    """Keep per-bearing HI buffers bounded during long stress/demo runs."""
    if len(_hi_history) <= MAX_HISTORY_BEARINGS:
        return
    eviction_count = min(HISTORY_EVICT_COUNT, len(_hi_history) - MAX_HISTORY_BEARINGS)
    oldest = sorted(
        _hi_history.keys(),
        key=lambda key: _hi_history[key][-1]["ts_minutes"] if _hi_history[key] else -1.0,
    )[:eviction_count]
    for bearing_id in oldest:
        del _hi_history[bearing_id]



# ---------------------------------------------------------------------------
# Stage 1 — Autoencoder → Health Indicator
# ---------------------------------------------------------------------------

def run_ae(features: dict[str, float]) -> tuple[float, float]:
    """
    Map 70 feature values → (hi_raw, reconstruction_error).
    hi_raw = mean absolute reconstruction error (used as HI proxy).
    """
    ml.assert_loaded()

    # Build input vector in the exact column order the scaler was fitted on
    vec = np.array([features.get(name, np.nan) for name in ml.ae_features], dtype=np.float32)
    vec = vec.reshape(1, -1)

    vec = ml.ae_imputer.transform(vec)
    vec = ml.ae_scaler.transform(vec)

    x = torch.from_numpy(vec.astype(np.float32))
    with torch.no_grad():
        recon, _ = ml.ae_model(x)

    recon_error = float(torch.mean(torch.abs(recon - x)).item())
    return recon_error, recon_error   # hi_raw == recon_error for now


# ---------------------------------------------------------------------------
# Stage 1 post-processing per bearing
# ---------------------------------------------------------------------------

def _update_hi_history(
    bearing_id: str,
    hi_raw: float,
    elapsed_minutes: float,
    rpm: int,
    load_kn: float,
) -> deque:
    if bearing_id not in _hi_history:
        _hi_history[bearing_id] = deque(maxlen=SEQ_LEN)

    buf = _hi_history[bearing_id]
    buf.append({
        "hi_raw":         hi_raw,
        "ts_minutes":     elapsed_minutes,
        "rpm":            rpm,
        "load_kn":        load_kn,
    })
    return buf


def _normalise_hi(buf: deque) -> list[float]:
    """
    Apply per-bearing normalisation to the HI buffer:
    log1p → cummax → min-max scale to [0, 1].
    Returns list of normalised HI values (same length as buf).
    """
    raw = np.array([e["hi_raw"] for e in buf], dtype=np.float64)
    log1p = np.log1p(raw)
    cummax = np.maximum.accumulate(log1p)
    mn, mx = cummax.min(), cummax.max()
    if mx - mn < 1e-9:
        return [0.0] * len(buf)
    return list((cummax - mn) / (mx - mn))


def _build_sequence(buf: deque, hi_normalised: list[float], max_time: float) -> np.ndarray:
    """
    Build (seq_len, 6) input matrix for the LSTM.
    Channels: hi_z, hi_velocity, hi_accel, rotation_hz_norm, load_kn_norm, time_norm
    If buffer has fewer than SEQ_LEN steps, pad left with the first valid entry.
    """
    hi_mean = ml.rul_scaler["hi_mean"]
    hi_std  = ml.rul_scaler["hi_std"]
    vel_std = ml.rul_scaler["vel_std"]
    acc_std = ml.rul_scaler["acc_std"]
    max_t   = ml.rul_scaler.get("max_time", max_time)

    hi_arr = np.array(hi_normalised, dtype=np.float64)

    # Velocity and acceleration (finite differences, padded)
    vel = np.diff(hi_arr, prepend=hi_arr[0])
    acc = np.diff(vel,    prepend=vel[0])

    rows = []
    for i, entry in enumerate(buf):
        rpm      = entry["rpm"]
        load_kn  = entry["load_kn"]
        t_min    = entry["ts_minutes"]

        rotation_hz = rpm / 60.0
        hi_z            = (hi_arr[i] - hi_mean) / (hi_std + 1e-9)
        hi_velocity     = vel[i] / (vel_std + 1e-9)
        hi_accel        = acc[i] / (acc_std + 1e-9)
        rotation_norm   = (rotation_hz - 35.0) / 5.0
        load_norm       = (load_kn - 10.0) / 2.0
        time_norm       = min(t_min / (max_t + 1e-9), 1.5)

        rows.append([hi_z, hi_velocity, hi_accel, rotation_norm, load_norm, time_norm])

    seq = np.array(rows, dtype=np.float32)          # (actual_len, 6)

    # Left-pad if fewer than SEQ_LEN steps
    if len(seq) < SEQ_LEN:
        pad = np.tile(seq[0], (SEQ_LEN - len(seq), 1))
        seq = np.vstack([pad, seq])

    return seq  # (SEQ_LEN, 6)


# ---------------------------------------------------------------------------
# Stage 2 — MC Dropout LSTM
# ---------------------------------------------------------------------------

def run_mc_dropout(seq: np.ndarray, n_passes: int = 50) -> dict:
    """
    seq: (SEQ_LEN, 6) numpy array
    Returns dict with rul statistics and raw pfail.
    """
    ml.assert_loaded()

    x = torch.from_numpy(seq).unsqueeze(0)   # (1, SEQ_LEN, 6)

    log_max_rul = ml.rul_scaler["log_max_rul"]
    max_rul     = ml.rul_scaler["max_rul"]
    ood_thresh  = ml.model_card["uncertainty"]["ood_threshold"]

    rul_preds:   list[float] = []
    pfail_preds: list[float] = []

    ml.rul_model.train()   # ensure dropout is active
    with torch.no_grad():
        for _ in range(n_passes):
            rul_logit, pfail_logit = ml.rul_model(x)
            rul_norm  = torch.sigmoid(rul_logit).item()
            pfail_raw = torch.sigmoid(pfail_logit).item()

            # Invert log-normalisation: expm1(rul_norm * log_max_rul)
            rul_min = float(np.expm1(rul_norm * log_max_rul))
            rul_min = max(0.0, min(rul_min, max_rul))

            rul_preds.append(rul_min)
            pfail_preds.append(pfail_raw)

    rul_arr   = np.array(rul_preds)
    pfail_arr = np.array(pfail_preds)

    rul_mean  = float(rul_arr.mean())
    rul_std   = float(rul_arr.std())
    rul_lower = float(np.percentile(rul_arr, 2.5))
    rul_upper = float(np.percentile(rul_arr, 97.5))
    pfail_raw_mean = float(pfail_arr.mean())
    ood_flag  = rul_std > ood_thresh

    return {
        "rul_mean":      rul_mean,
        "rul_std":       rul_std,
        "rul_lower":     rul_lower,
        "rul_upper":     rul_upper,
        "pfail_raw":     pfail_raw_mean,
        "ood_flag":      ood_flag,
    }


def _platt_calibrate(pfail_raw: float) -> float:
    """Apply Platt scaling: sigmoid(coef * logit(p) + intercept)."""
    eps = 1e-7
    p   = max(eps, min(1 - eps, pfail_raw))
    logit = math.log(p / (1 - p))
    calibrated = 1.0 / (1.0 + math.exp(-(ml.platt_coef * logit + ml.platt_intercept)))
    return float(calibrated)


def _degradation_rate(bearing_id: str) -> Optional[float]:
    """Slope of last 5 HI values (simple linear regression)."""
    buf = _hi_history.get(bearing_id)
    if buf is None or len(buf) < 2:
        return None
    window = list(buf)[-5:]
    hi_vals = [e["hi_raw"] for e in window]
    if len(hi_vals) < 2:
        return None
    x = np.arange(len(hi_vals), dtype=np.float64)
    slope = float(np.polyfit(x, hi_vals, 1)[0])
    return slope


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

class BearingContext:
    """Minimal metadata needed to build the LSTM sequence."""
    def __init__(self, rpm: int, load_kn: float, elapsed_minutes: float):
        self.rpm = rpm
        self.load_kn = load_kn
        self.elapsed_minutes = elapsed_minutes


def predict(record: FeatureRecord, ctx: BearingContext) -> PredictionRecord:
    """
    Full two-stage inference for one bearing at one timestep.
    Maintains per-bearing HI history buffer internally.
    """
    ml.assert_loaded()
    _cleanup_hi_history()
    n_passes = ml.model_card.get("uncertainty", {}).get("mc_passes", 50)

    # Detect replay / restart: if elapsed_minutes regressed, the bearing run
    # has been reset (demo replay or new real run starting from file 1).
    # Discard the stale buffer so the sequence doesn't mix old and new data.
    existing = _hi_history.get(record.bearing_id)
    if existing and existing[-1]["ts_minutes"] > ctx.elapsed_minutes:
        log.info(
            "[%s] Replay detected (elapsed %.1f < last %.1f) — resetting HI buffer",
            record.bearing_id,
            ctx.elapsed_minutes,
            existing[-1]["ts_minutes"],
        )
        del _hi_history[record.bearing_id]

    # Stage 1
    hi_raw, _ = run_ae(record.features)

    buf = _update_hi_history(
        record.bearing_id, hi_raw,
        ctx.elapsed_minutes, ctx.rpm, ctx.load_kn,
    )

    hi_norm = _normalise_hi(buf)
    seq     = _build_sequence(buf, hi_norm, ml.rul_scaler["max_time"])

    # Stage 2
    mc = run_mc_dropout(seq, n_passes=n_passes)

    p_fail_raw = mc["pfail_raw"]
    p_fail = _platt_calibrate(p_fail_raw)
    health_score = round((1.0 - p_fail) * 100.0, 2)

    log.info(
        "[%s] pfail_raw=%.4f pfail_calibrated=%.4f hi_raw=%.4f health=%.1f",
        record.bearing_id,
        p_fail_raw,
        p_fail,
        hi_raw,
        health_score,
    )

    deg_rate = _degradation_rate(record.bearing_id)

    return PredictionRecord(
        bearing_id=record.bearing_id,
        file_idx=record.file_idx,
        sample_ts=record.sample_ts,
        rul_minutes=round(mc["rul_mean"], 2),
        rul_lower_minutes=round(mc["rul_lower"], 2),
        rul_upper_minutes=round(mc["rul_upper"], 2),
        rul_uncertainty=round(mc["rul_std"], 6),
        p_fail=round(p_fail, 6),
        health_score=health_score,
        degradation_rate=round(deg_rate, 6) if deg_rate is not None else None,
        ood_flag=mc["ood_flag"],
        model_version=settings.MODEL_VERSION,
    )


# avoid circular import
from shared.config import settings
