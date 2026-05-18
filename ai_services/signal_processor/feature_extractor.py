from __future__ import annotations

import numpy as np
import pywt
from scipy import signal, stats

# ── Constants ────────────────────────────────────────────────────────────────

SAMPLE_RATE: int = 25_600        # Hz — fixed for ALL XJTU-SY conditions
WAVELET: str = "db4"             # Daubechies-4 wavelet
WP_LEVEL: int = 4                # → 2^4 = 16 nodes

# Condition → shaft RPM
CONDITION_RPM: dict[int, int] = {1: 2100, 2: 2250, 3: 2400}

# Broad energy bands (Hz) — fixed, not RPM-dependent
_ENERGY_BANDS = {
    "low":  (0.0,    2_000.0),
    "mid":  (2_000.0, 8_000.0),
    "high": (8_000.0, SAMPLE_RATE / 2),
}

# LDK UER204 bearing geometry
_Z:  float = 8.0
_d:  float = 7.92
_Dm: float = 34.55

_BPFO_MULT = (_Z / 2.0) * (1.0 - _d / _Dm)   # ≈ 3.0835
_BPFI_MULT = (_Z / 2.0) * (1.0 + _d / _Dm)   # ≈ 4.9165
_BSF_MULT  = (_Dm / (2.0 * _d)) * (1.0 - (_d / _Dm) ** 2)  # ≈ 2.0608
_FTF_MULT  = 0.5 * (1.0 - _d / _Dm)           # ≈ 0.3854
_BAND_MARGIN = 0.20


# ── Helpers ──────────────────────────────────────────────────────────────────

def _fault_bands(rpm: float) -> list[tuple[float, float]]:
    """Return 4 envelope bands (BPFO, BPFI, BSF, FTF) for given RPM."""
    f_r = rpm / 60.0
    centres = [
        _BPFO_MULT * f_r,
        _BPFI_MULT * f_r,
        _BSF_MULT  * f_r,
        _FTF_MULT  * f_r,
    ]
    return [(c * (1 - _BAND_MARGIN), c * (1 + _BAND_MARGIN)) for c in centres]


def _channel_features(
    x: np.ndarray,
    freqs: np.ndarray,
    power: np.ndarray,
    total_p: float,
    rpm: float,
) -> list[float]:
    """
    Compute 34 features for one channel.

    Args:
        x:       Raw 1-D signal (float64, already normalised).
        freqs:   rfftfreq array (shared, computed once).
        power:   FFT power spectrum of x (|rfft(x)|^2 * (2/n)^2).
        total_p: Sum of power (+ eps).
        rpm:     Shaft speed for fault-band calculation.

    Returns:
        List of 34 floats in the order defined in the module docstring.
    """
    # ── Time domain ──────────────────────────────────────────────────────────
    rms      = float(np.sqrt(np.mean(x ** 2)))
    peak     = float(np.max(np.abs(x)))
    mean_abs = float(np.mean(np.abs(x)))
    sqrt_mean_abs = float(np.sqrt(mean_abs + 1e-12))

    p2p              = float(np.max(x) - np.min(x))
    mean_val         = float(np.mean(x))
    var_val          = float(np.var(x))
    skewness         = float(stats.skew(x))
    kurtosis         = float(stats.kurtosis(x))
    shape_factor     = rms / (mean_abs + 1e-12)
    clearance_factor = peak / (sqrt_mean_abs + 1e-12)

    # ── Frequency domain ─────────────────────────────────────────────────────
    spec_centroid = float(np.dot(freqs, power) / total_p)

    norm_power = power / total_p
    spec_entropy = float(-np.sum(norm_power * np.log(norm_power + 1e-12)))

    fft_mag = np.sqrt(power)
    spec_kurtosis = float(stats.kurtosis(fft_mag))

    dom_freq = float(freqs[np.argmax(power)])

    def _band_ratio(lo: float, hi: float) -> float:
        mask = (freqs >= lo) & (freqs <= hi)
        return float(power[mask].sum() / total_p) if mask.any() else 0.0

    energy_low  = _band_ratio(*_ENERGY_BANDS["low"])
    energy_mid  = _band_ratio(*_ENERGY_BANDS["mid"])
    energy_high = _band_ratio(*_ENERGY_BANDS["high"])

    # ── Envelope bands ────────────────────────────────────────────────────────
    envelope = np.abs(signal.hilbert(x))
    n = len(envelope)
    env_freqs = np.fft.rfftfreq(n, d=1.0 / SAMPLE_RATE)
    env_fft   = np.abs(np.fft.rfft(envelope)) * (2.0 / n)
    env_power = env_fft ** 2
    env_total = env_power.sum() + 1e-12

    def _env_band_ratio(lo: float, hi: float) -> float:
        mask = (env_freqs >= lo) & (env_freqs <= hi)
        return float(env_power[mask].sum() / env_total) if mask.any() else 0.0

    fault_bands = _fault_bands(rpm)
    env_b1 = _env_band_ratio(*fault_bands[0])
    env_b2 = _env_band_ratio(*fault_bands[1])
    env_b3 = _env_band_ratio(*fault_bands[2])
    env_b4 = _env_band_ratio(*fault_bands[3])

    # ── Wavelet packet (db4, level 4, 16 nodes) ───────────────────────────────
    wp = pywt.WaveletPacket(data=x, wavelet=WAVELET, mode="symmetric", maxlevel=WP_LEVEL)
    nodes = [node.path for node in wp.get_level(WP_LEVEL, "natural")]
    wp_energies_raw = np.array([np.sum(wp[nd].data ** 2) for nd in nodes], dtype=np.float64)
    wp_total = wp_energies_raw.sum() + 1e-12
    wp_energies = (wp_energies_raw / wp_total).tolist()   # normalised, sum ≈ 1

    return [
        p2p, mean_val, var_val, skewness, kurtosis,
        shape_factor, clearance_factor,
        spec_centroid, spec_entropy, spec_kurtosis, dom_freq,
        energy_low, energy_mid, energy_high,
        env_b1, env_b2, env_b3, env_b4,
        *wp_energies,   # 16 values
    ]   # total: 7 + 4 + 4 + 4 + 16 = 34 ✓


# ── Public API ───────────────────────────────────────────────────────────────

def extract_features(
    signal_2ch: np.ndarray,
    *,
    sample_rate: int = SAMPLE_RATE,
    rpm: float = 2100.0,
) -> dict[str, float]:
    """
    Extract all 70 features from a 2-channel vibration signal.

    Args:
        signal_2ch:  Shape (2, N) — row 0 = horizontal, row 1 = vertical.
                     Accepts (N,) for single-channel fallback (duplicates channel).
        sample_rate: ADC rate in Hz (default 25 600).
        rpm:         Shaft speed for fault-band calculation.
                     Use CONDITION_RPM[condition_id] from ingestion.

    Returns:
        Ordered dict of 70 feature_name → float (matches ae_feature_names.json).
    """
    if signal_2ch.ndim == 1:
        signal_2ch = np.stack([signal_2ch, signal_2ch])

    h = signal_2ch[0].astype(np.float64)
    v = signal_2ch[1].astype(np.float64)
    n = len(h)

    # FFT — both channels share the same length/sample rate so the frequency
    # bins are identical, but compute v_freqs explicitly so any future refactor
    # that changes signal length per-channel doesn't silently mis-bin the v channel.
    freqs     = np.fft.rfftfreq(n, d=1.0 / sample_rate)
    h_freqs   = freqs
    v_freqs   = freqs
    h_fft_mag = np.abs(np.fft.rfft(h)) * (2.0 / n)
    h_power   = h_fft_mag ** 2
    h_total_p = h_power.sum() + 1e-12

    v_fft_mag = np.abs(np.fft.rfft(v)) * (2.0 / n)
    v_power   = v_fft_mag ** 2
    v_total_p = v_power.sum() + 1e-12

    h_feats = _channel_features(h, h_freqs, h_power, h_total_p, rpm)
    v_feats = _channel_features(v, v_freqs, v_power, v_total_p, rpm)

    # ── Cross-channel ────────────────────────────────────────────────────────
    hv_corr      = float(np.corrcoef(h, v)[0, 1])
    h_rms        = float(np.sqrt(np.mean(h ** 2)))
    v_rms        = float(np.sqrt(np.mean(v ** 2)))
    hv_rms_ratio = h_rms / (v_rms + 1e-12)

    # ── Build ordered dict matching ae_feature_names.json ────────────────────
    prefixes_h = [
        "h_p2p", "h_mean", "h_var", "h_skewness", "h_kurtosis",
        "h_shape_factor", "h_clearance_factor",
        "h_spectral_centroid", "h_spectral_entropy", "h_spectral_kurtosis", "h_dom_freq",
        "h_energy_low", "h_energy_mid", "h_energy_high",
        "h_env_b1", "h_env_b2", "h_env_b3", "h_env_b4",
        *[f"h_wp_{i}" for i in range(16)],
    ]
    prefixes_v = [p.replace("h_", "v_", 1) for p in prefixes_h]

    result: dict[str, float] = {}
    for name, val in zip(prefixes_h, h_feats):
        result[name] = val
    for name, val in zip(prefixes_v, v_feats):
        result[name] = val
    result["hv_corr"]      = hv_corr
    result["hv_rms_ratio"] = hv_rms_ratio

    return result
