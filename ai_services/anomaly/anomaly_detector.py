"""
Hybrid anomaly detector.

Score formula (3 components):
    component_1 (55%) = p_fail_calibrated
    component_2 (25%) = RMS z-score vs healthy baseline  (clamped 0-1)
    component_3 (20%) = RUL drop rate over last 5 steps  (clamped 0-1)
    hybrid_score      = 0.55*c1 + 0.25*c2 + 0.20*c3

Trigger logic:
    - K_consecutive scores >= tau  →  trigger
    - After trigger: cooldown N cycles (no new trigger)
    - Escalation: re-trigger during cooldown if score rises > delta
"""
from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass
from typing import Optional

log = logging.getLogger(__name__)

WEIGHTS = (0.55, 0.25, 0.20)


@dataclass
class AnomalyConfig:
    tau:               float = 0.60
    K_consecutive:     int   = 3
    cooldown_cycles:   int   = 5
    delta_escalation:  float = 0.15
    rms_mean:          float = 0.0
    rms_std:           float = 1.0
    kurt_mean:         float = 3.0
    kurt_std:          float = 1.0

    @classmethod
    def from_thresholds(cls, cfg: dict) -> "AnomalyConfig":
        baseline = cfg.get("healthy_baseline", {})
        anomaly  = cfg.get("anomaly", {})
        return cls(
            tau              = anomaly.get("tau",               0.60),
            K_consecutive    = anomaly.get("K_consecutive",     3),
            cooldown_cycles  = anomaly.get("cooldown_cycles",   5),
            delta_escalation = anomaly.get("delta_escalation",  0.15),
            rms_mean         = baseline.get("rms_mean",         0.0),
            rms_std          = baseline.get("rms_std",          1.0),
            kurt_mean        = baseline.get("kurt_mean",        3.0),
            kurt_std         = baseline.get("kurt_std",         1.0),
        )


@dataclass
class TriggerInfo:
    bearing_id:     str
    file_idx:       int
    hybrid_score:   float
    stat_score:     float
    rul_drop_score: float
    p_fail:         float
    consecutive:    int
    escalation:     bool = False


class BearingState:
    """Per-bearing running state."""

    def __init__(self, bearing_id: str, cfg: AnomalyConfig):
        self.bearing_id = bearing_id
        self.cfg = cfg
        self.last_file_idx: int = 0
        self._consecutive: int = 0
        self._cooldown_remaining: int = 0
        self._last_score_in_cooldown: float = 0.0
        self._rul_history: deque[float] = deque(maxlen=6)

    def compute_score(
        self,
        p_fail: float,
        rms: float,
        rul_minutes: float,
    ) -> tuple[float, float, float, float]:
        """Returns (hybrid, c1_pfail, c2_stat, c3_rul_drop)."""
        c1 = max(0.0, min(1.0, p_fail))

        if self.cfg.rms_std > 1e-9:
            z = (rms - self.cfg.rms_mean) / self.cfg.rms_std
        else:
            z = 0.0
        c2 = max(0.0, min(1.0, z / 3.0))

        c3 = self._rul_drop_score(rul_minutes)
        hybrid = WEIGHTS[0] * c1 + WEIGHTS[1] * c2 + WEIGHTS[2] * c3
        return round(hybrid, 6), round(c1, 6), round(c2, 6), round(c3, 6)

    def _rul_drop_score(self, current_rul: float) -> float:
        history = list(self._rul_history)
        if len(history) < 2:
            return 0.0
        window = history[-5:]
        drop = window[0] - current_rul
        max_drop = max(window[0], 1.0)
        return max(0.0, min(1.0, drop / max_drop))

    def update(
        self,
        file_idx:    int,
        p_fail:      float,
        rms:         float,
        rul_minutes: float,
    ) -> Optional[TriggerInfo]:
        self._rul_history.append(rul_minutes)
        hybrid, c1, c2, c3 = self.compute_score(p_fail, rms, rul_minutes)

        triggered  = False
        escalation = False

        if self._cooldown_remaining > 0:
            self._cooldown_remaining -= 1
            if hybrid - self._last_score_in_cooldown > self.cfg.delta_escalation:
                triggered  = True
                escalation = True
                log.info(
                    "[%s] Escalation during cooldown: %.3f → %.3f",
                    self.bearing_id, self._last_score_in_cooldown, hybrid,
                )
            self._last_score_in_cooldown = hybrid
        else:
            if hybrid >= self.cfg.tau:
                self._consecutive += 1
            else:
                self._consecutive = 0

            if self._consecutive >= self.cfg.K_consecutive:
                triggered = True
                self._consecutive = 0

        if triggered:
            self._cooldown_remaining = self.cfg.cooldown_cycles
            self._last_score_in_cooldown = hybrid
            return TriggerInfo(
                bearing_id=self.bearing_id,
                file_idx=file_idx,
                hybrid_score=hybrid,
                stat_score=c2,
                rul_drop_score=c3,
                p_fail=p_fail,
                consecutive=self._consecutive,
                escalation=escalation,
            )
        return None


class AnomalyDetector:
    """Manages per-bearing BearingState instances."""

    def __init__(self, cfg: AnomalyConfig):
        self.cfg = cfg
        self._states: dict[str, BearingState] = {}

    def _state(self, bearing_id: str) -> BearingState:
        if bearing_id not in self._states:
            self._states[bearing_id] = BearingState(bearing_id, self.cfg)
        return self._states[bearing_id]

    def update(
        self,
        bearing_id:  str,
        file_idx:    int,
        p_fail:      float,
        rms:         float,
        rul_minutes: float,
    ) -> Optional[TriggerInfo]:
        state = self._states.get(bearing_id)
        if state is not None and file_idx <= state.last_file_idx:
            log.info(
                "[%s] Resetting anomaly state for replay/reused bearing_id: file_idx %d after %d",
                bearing_id,
                file_idx,
                state.last_file_idx,
            )
            self._states[bearing_id] = BearingState(bearing_id, self.cfg)
        self._state(bearing_id).last_file_idx = file_idx
        return self._state(bearing_id).update(file_idx, p_fail, rms, rul_minutes)

    def compute_score(
        self,
        bearing_id:  str,
        p_fail:      float,
        rms:         float,
        rul_minutes: float,
    ) -> tuple[float, float, float, float]:
        return self._state(bearing_id).compute_score(p_fail, rms, rul_minutes)
