from __future__ import annotations

from shared.schemas import FaultType

# Envelope band features extracted by signal_processor (BPFO, BPFI, BSF, FTF order)
_H_ENV: list[str] = ["h_env_b1", "h_env_b2", "h_env_b3", "h_env_b4"]
_V_ENV: list[str] = ["v_env_b1", "v_env_b2", "v_env_b3", "v_env_b4"]

# Fault type order matches bearing frequency order: b1=BPFO, b2=BPFI, b3=BSF, b4=FTF
_FAULT_NAMES: list[FaultType] = ["OUTER_RACE", "INNER_RACE", "BALL", "CAGE"]

# Kurtosis threshold: below this the bearing is likely still healthy
_KURT_HEALTHY = 3.5

# Minimum envelope band energy fraction to treat as a meaningful fault signature
_MIN_ENERGY = 0.08


def detect(features: dict[str, float]) -> tuple[FaultType, float]:
    """
    Return (fault_type, confidence) using envelope band energy ratios.

    Envelope bands map to bearing fault frequencies computed from shaft RPM:
      b1 = BPFO (outer race), b2 = BPFI (inner race),
      b3 = BSF  (ball),       b4 = FTF  (cage).

    Both horizontal and vertical channel bands are averaged so that the
    dominant fault band is identified across both axes.
    """
    kurt = features.get("h_kurtosis", 0.0)

    # Low kurtosis → signal still in healthy / early-degradation regime
    if kurt < _KURT_HEALTHY:
        return "UNKNOWN", 0.1

    # Average H and V envelope band energies per fault frequency
    bands: list[float] = [
        (features.get(h, 0.0) + features.get(v, 0.0)) / 2.0
        for h, v in zip(_H_ENV, _V_ENV)
    ]

    dominant_idx = bands.index(max(bands))
    dominant = bands[dominant_idx]

    # Not enough energy concentrated in any fault band → ambiguous pattern
    if dominant < _MIN_ENERGY:
        confidence = min(0.45, kurt / 20.0)
        return "UNKNOWN", round(confidence, 3)

    # SNR: ratio of dominant band energy to mean of the other three bands
    others = [e for i, e in enumerate(bands) if i != dominant_idx]
    mean_others = sum(others) / len(others) if others else 1e-9
    snr = dominant / (mean_others + 1e-9)

    # Confidence: energy fraction → base, boosted by SNR and kurtosis magnitude
    base = min(1.0, dominant * 4.0)
    snr_boost = min(0.3, (snr - 1.0) / 10.0)       # saturates at SNR ≈ 4
    kurt_boost = min(0.2, (kurt - _KURT_HEALTHY) / 30.0)
    confidence = min(1.0, base + snr_boost + kurt_boost)

    return _FAULT_NAMES[dominant_idx], round(confidence, 3)
