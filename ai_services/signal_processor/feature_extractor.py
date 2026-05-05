from __future__ import annotations

import numpy as np
from scipy import signal, stats

# Constants

SAMPLE_RATE: int = 25_600

_Z: float = 8.0
_d: float = 7.92
_Dm: float = 34.55

# Characteristic frequency multipliers (× shaft frequency f_r = RPM/60)
_BPFO_MULT: float = (_Z / 2.0) * (1.0 - _d / _Dm)  # ≈ 3.0835
_BPFI_MULT: float = (_Z / 2.0) * (1.0 + _d / _Dm)  # ≈ 4.9165
_BSF_MULT: float = (_Dm / (2.0 * _d)) * (1.0 - (_d / _Dm) ** 2)  # ≈ 2.0608
_FTF_MULT: float = 0.5 * (1.0 - _d / _Dm)  # ≈ 0.3854

# Band half-width: ±20 % of centre frequency
_BAND_MARGIN: float = 0.20

# Condition → shaft RPM (used by ingestion to pass the correct rpm)
CONDITION_RPM: dict[int, int] = {1: 2100, 2: 2250, 3: 2400}

# Helper functions


def _fault_bands(rpm: float) -> dict[str, tuple[float, float]]:
    """
    Compute BPFO/BPFI/BSF/FTF frequency bands for a given shaft speed.
    """

    f_r = rpm / 60.0
    centres = {
        "bpfo": _BPFO_MULT * f_r,
        "bpfi": _BPFI_MULT * f_r,
        "bsf": _BSF_MULT * f_r,
        "ftf": _FTF_MULT * f_r,
    }
    return {
        name: (fc * (1.0 - _BAND_MARGIN), fc * (1.0 + _BAND_MARGIN))
        for name, fc in centres.items()
    }


# Public API


def extract_features(
    data: np.ndarray,
    *,
    sample_rate: int = SAMPLE_RATE,
    rpm: float = 2100.0,
) -> dict[str, float]:
    """
    Extract 18 diagnostic features from a 1-D vibration signal.

    Args:
        data:        Raw vibration samples (float32 / float64).
        sample_rate: ADC sampling frequency in Hz (default 25 600 for XJTU-SY).
        rpm:         Shaft speed for this bearing condition.
                     Use CONDITION_RPM[condition_id] from the ingestion layer.

    Returns:
        Dict with 18 feature_name → float entries (deterministic key order).
    """
    data = data.astype(np.float64)
    n = len(data)

    # Time domain features
    rms = float(np.sqrt(np.mean(data**2)))
    peak = float(np.max(np.abs(data)))
    mean_abs = float(np.mean(np.abs(data)))
    std = float(np.std(data))
    kurtosis = float(stats.kurtosis(data))  # excess kurtosis (Fisher)
    skewness = float(stats.skew(data))
    crest = peak / (rms + 1e-12)
    shape = rms / (mean_abs + 1e-12)
    impulse = peak / (mean_abs + 1e-12)
    peak2peak = float(np.max(data) - np.min(data))

    # Frequency domain features
    freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate)
    fft_mag = np.abs(np.fft.rfft(data)) * (2.0 / n)

    # Spectral features
    power = fft_mag**2
    total_p = power.sum() + 1e-12

    # Spectral centroid, RMS, and kurtosis
    spec_centroid = float(np.dot(freqs, power) / total_p)
    spec_rms = float(np.sqrt(np.mean(power)))
    spec_kurtosis = float(stats.kurtosis(fft_mag))

    bands = _fault_bands(rpm)

    def _band_ratio(lo: float, hi: float) -> float:
        mask = (freqs >= lo) & (freqs <= hi)
        return float(power[mask].sum() / total_p) if mask.any() else 0.0

    bpfo_ratio = _band_ratio(*bands["bpfo"])
    bpfi_ratio = _band_ratio(*bands["bpfi"])
    bsf_ratio = _band_ratio(*bands["bsf"])
    ftf_ratio = _band_ratio(*bands["ftf"])

    # Envelope / Hilbert features
    envelope = np.abs(signal.hilbert(data))
    env_rms = float(np.sqrt(np.mean(envelope**2)))
    env_kurtosis = float(stats.kurtosis(envelope))

    return {
        # time
        "rms": rms,
        "peak": peak,
        "std": std,
        "kurtosis": kurtosis,
        "skewness": skewness,
        "crest_factor": crest,
        "shape_factor": shape,
        "impulse_factor": impulse,
        "peak2peak": peak2peak,
        # frequency
        "spectral_centroid": spec_centroid,
        "spectral_rms": spec_rms,
        "spectral_kurtosis": spec_kurtosis,
        "bpfo_energy_ratio": bpfo_ratio,
        "bpfi_energy_ratio": bpfi_ratio,
        "bsf_energy_ratio": bsf_ratio,
        "ftf_energy_ratio": ftf_ratio,
        # envelope
        "env_rms": env_rms,
        "env_kurtosis": env_kurtosis,
    }
