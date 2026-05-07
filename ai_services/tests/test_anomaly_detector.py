"""
Tests for anomaly detector:
  - Score computation (3 components + hybrid)
  - Trigger logic (K_consecutive, cooldown, escalation)
  - Config loading from thresholds dict
"""
from __future__ import annotations

import pytest
from anomaly.anomaly_detector import (
    AnomalyConfig,
    AnomalyDetector,
    BearingState,
    TriggerInfo,
    WEIGHTS,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def default_cfg() -> AnomalyConfig:
    return AnomalyConfig(
        tau=0.60,
        K_consecutive=3,
        cooldown_cycles=5,
        delta_escalation=0.15,
        rms_mean=0.5,
        rms_std=0.2,
    )


@pytest.fixture()
def detector(default_cfg) -> AnomalyDetector:
    return AnomalyDetector(default_cfg)


@pytest.fixture()
def state(default_cfg) -> BearingState:
    return BearingState("Bearing2_4", default_cfg)


# ---------------------------------------------------------------------------
# AnomalyConfig
# ---------------------------------------------------------------------------

class TestAnomalyConfig:
    def test_from_thresholds_full(self):
        raw = {
            "healthy_baseline": {
                "rms_mean": 1.0, "rms_std": 0.3,
                "kurt_mean": 3.5, "kurt_std": 0.8,
            },
            "anomaly": {
                "tau": 0.65, "K_consecutive": 4,
                "cooldown_cycles": 6, "delta_escalation": 0.20,
            },
        }
        cfg = AnomalyConfig.from_thresholds(raw)
        assert cfg.tau == 0.65
        assert cfg.K_consecutive == 4
        assert cfg.rms_mean == 1.0
        assert cfg.rms_std == 0.3

    def test_from_thresholds_missing_keys_uses_defaults(self):
        cfg = AnomalyConfig.from_thresholds({})
        assert cfg.tau == 0.60
        assert cfg.K_consecutive == 3
        assert cfg.rms_mean == 0.0


# ---------------------------------------------------------------------------
# Score computation
# ---------------------------------------------------------------------------

class TestScoreComputation:
    def test_weights_sum_to_one(self):
        assert abs(sum(WEIGHTS) - 1.0) < 1e-9

    def test_zero_pfail_zero_rms_zero_score(self, state):
        hybrid, c1, c2, c3 = state.compute_score(p_fail=0.0, rms=0.0, rul_minutes=1000.0)
        assert c1 == 0.0
        assert hybrid < 0.05

    def test_pfail_one_yields_high_hybrid(self, state):
        hybrid, c1, c2, c3 = state.compute_score(p_fail=1.0, rms=0.0, rul_minutes=1000.0)
        assert c1 == 1.0
        assert hybrid >= WEIGHTS[0]   # at least 55% contribution

    def test_rms_zscore_clamped_at_one(self, state):
        # rms = mean + 10*std  →  z=10  →  c2 should clamp at 1.0
        rms_extreme = state.cfg.rms_mean + 10 * state.cfg.rms_std
        _, _, c2, _ = state.compute_score(p_fail=0.0, rms=rms_extreme, rul_minutes=1000.0)
        assert c2 == 1.0

    def test_hybrid_bounded_0_1(self, state):
        for p in [0.0, 0.5, 1.0]:
            hybrid, *_ = state.compute_score(p_fail=p, rms=0.0, rul_minutes=500.0)
            assert 0.0 <= hybrid <= 1.0

    def test_rul_drop_score_zero_without_history(self, state):
        _, _, _, c3 = state.compute_score(p_fail=0.0, rms=0.0, rul_minutes=500.0)
        assert c3 == 0.0

    def test_rul_drop_score_positive_after_decline(self, state):
        # Feed a declining RUL sequence
        for rul in [500.0, 480.0, 450.0, 400.0, 330.0]:
            state._rul_history.append(rul)
        _, _, _, c3 = state.compute_score(p_fail=0.0, rms=0.0, rul_minutes=200.0)
        assert c3 > 0.0


# ---------------------------------------------------------------------------
# Trigger logic
# ---------------------------------------------------------------------------

def _high_rms(cfg: AnomalyConfig) -> float:
    """rms value that gives c2=1.0 (z-score=3)."""
    return cfg.rms_mean + 3 * cfg.rms_std


class TestTriggerLogic:
    """
    hybrid = 0.55*c1 + 0.25*c2 + 0.20*c3
    To exceed tau=0.60 need c1+c2 combination:
      p_fail=1.0 → c1=1.0 (0.55)
      rms=mean+3std → c2=1.0 (0.25)
      combined = 0.80 > 0.60 ✓
    """

    def test_no_trigger_below_k(self, detector, default_cfg):
        rms = _high_rms(default_cfg)
        for i in range(2):   # K=3, feed only 2
            result = detector.update("B1", i, p_fail=1.0, rms=rms, rul_minutes=100.0)
            assert result is None

    def test_triggers_on_k_consecutive(self, detector, default_cfg):
        rms = _high_rms(default_cfg)
        result = None
        for i in range(3):
            result = detector.update("B2", i, p_fail=1.0, rms=rms, rul_minutes=100.0)
        assert result is not None
        assert isinstance(result, TriggerInfo)
        assert result.bearing_id == "B2"

    def test_no_trigger_if_score_drops_below_tau(self, detector, default_cfg):
        rms = _high_rms(default_cfg)
        detector.update("B3", 0, p_fail=1.0, rms=rms, rul_minutes=100.0)
        detector.update("B3", 1, p_fail=1.0, rms=rms, rul_minutes=100.0)
        # Score drops below tau — counter resets
        detector.update("B3", 2, p_fail=0.0, rms=0.0, rul_minutes=1000.0)
        # Resume high — needs K_consecutive again from scratch
        result = detector.update("B3", 3, p_fail=1.0, rms=rms, rul_minutes=100.0)
        assert result is None

    def test_cooldown_suppresses_immediate_retrigger(self, detector, default_cfg):
        rms = _high_rms(default_cfg)
        for i in range(3):
            detector.update("B4", i, p_fail=1.0, rms=rms, rul_minutes=100.0)
        result = detector.update("B4", 3, p_fail=1.0, rms=rms, rul_minutes=100.0)
        assert result is None

    def test_cooldown_expires_and_retrigger_possible(self):
        cfg = AnomalyConfig(tau=0.60, K_consecutive=2, cooldown_cycles=2,
                            rms_mean=0.5, rms_std=0.2)
        det = AnomalyDetector(cfg)
        rms = _high_rms(cfg)

        # First trigger
        for i in range(2):
            det.update("B5", i, p_fail=1.0, rms=rms, rul_minutes=50.0)
        # Burn through cooldown (2 cycles)
        for i in range(2, 4):
            det.update("B5", i, p_fail=1.0, rms=rms, rul_minutes=50.0)
        # Cooldown expired — new K_consecutive trigger
        det.update("B5", 4, p_fail=1.0, rms=rms, rul_minutes=50.0)
        result = det.update("B5", 5, p_fail=1.0, rms=rms, rul_minutes=50.0)
        assert result is not None

    def test_escalation_during_cooldown(self):
        cfg = AnomalyConfig(tau=0.50, K_consecutive=2, cooldown_cycles=10,
                            delta_escalation=0.10, rms_mean=0.5, rms_std=0.2)
        det = AnomalyDetector(cfg)
        rms_low  = cfg.rms_mean + 1 * cfg.rms_std   # c2 ≈ 0.33
        rms_high = _high_rms(cfg)                    # c2 = 1.0

        # Trigger once: p_fail=0.80 + rms_low → hybrid ≈ 0.52 > tau=0.50
        for i in range(2):
            det.update("B6", i, p_fail=0.80, rms=rms_low, rul_minutes=200.0)

        # Score jumps > delta_escalation inside cooldown
        result = det.update("B6", 2, p_fail=1.0, rms=rms_high, rul_minutes=50.0)
        assert result is not None
        assert result.escalation is True

    def test_trigger_info_fields(self, default_cfg):
        det = AnomalyDetector(default_cfg)
        rms = _high_rms(default_cfg)
        result = None
        for i in range(3):
            result = det.update("B7", i, p_fail=1.0, rms=rms, rul_minutes=80.0)
        assert result.bearing_id == "B7"
        assert result.file_idx == 2
        assert 0.0 <= result.hybrid_score <= 1.0
        assert 0.0 <= result.p_fail <= 1.0

    def test_independent_states_per_bearing(self, detector, default_cfg):
        rms = _high_rms(default_cfg)
        for i in range(2):
            detector.update("B8", i, p_fail=1.0, rms=rms, rul_minutes=50.0)
        result = detector.update("B9", 0, p_fail=0.0, rms=0.0, rul_minutes=1000.0)
        assert result is None
