from __future__ import annotations

from shared.schemas import FaultType


# Thresholds tuned on XJTU-SY healthy baseline
_KURTOSIS_HIGH   = 5.0
_KURTOSIS_MEDIUM = 3.5
_CREST_HIGH      = 4.5
_RMS_ELEVATED    = 1.5    # relative to a normalised scale (0-1 ish)
_SPEC_ENTROPY_HIGH = 0.75


def detect(features: dict[str, float]) -> tuple[FaultType, float]:
    """
    Return (fault_type, confidence) from extracted feature dict.
    Priority order: INNER_RACE > OUTER_RACE > BALL > CAGE > UNKNOWN.
    """
    kurt    = features.get("kurtosis", 0.0)
    crest   = features.get("crest_factor", 0.0)
    rms     = features.get("rms", 0.0)
    spec_e  = features.get("spectral_entropy", 0.0)
    shape_f = features.get("shape_factor", 0.0)
    hi      = features.get("hi", 0.0)

    # INNER_RACE: very high kurtosis + high crest factor
    # Spalling on inner race causes sharp, high-energy impulses
    if kurt >= _KURTOSIS_HIGH and crest >= _CREST_HIGH:
        confidence = min(1.0, (kurt / 10.0 + crest / 8.0) / 2.0)
        return "INNER_RACE", round(confidence, 3)

    # OUTER_RACE: high kurtosis + moderately elevated RMS
    # Outer race defect produces periodic impacts, energy builds gradually
    if kurt >= _KURTOSIS_MEDIUM and rms >= _RMS_ELEVATED:
        confidence = min(1.0, kurt / 8.0 * 0.6 + min(rms / 3.0, 1.0) * 0.4)
        return "OUTER_RACE", round(confidence, 3)

    # BALL: high spectral entropy + medium kurtosis
    # Ball defects spread energy across many frequency bands
    if spec_e >= _SPEC_ENTROPY_HIGH and _KURTOSIS_MEDIUM * 0.8 <= kurt < _KURTOSIS_HIGH:
        confidence = min(1.0, spec_e * 0.7 + (kurt / _KURTOSIS_HIGH) * 0.3)
        return "BALL", round(confidence, 3)

    # CAGE: low RMS but abnormal shape factor
    # Cage defects distort the waveform shape without raising overall energy much
    if rms < _RMS_ELEVATED * 0.8 and shape_f > 1.6:
        confidence = min(1.0, shape_f / 3.0 * 0.6 + (1.0 - rms) * 0.4)
        return "CAGE", round(max(0.0, confidence), 3)

    # UNKNOWN: degradation detected (hi > 0) but pattern unclear
    if hi > 0.3:
        return "UNKNOWN", round(min(0.5, hi), 3)

    return "UNKNOWN", 0.1
