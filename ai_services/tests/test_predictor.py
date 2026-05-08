"""
Tests for the full inference pipeline:
  Stage 1 — AE → Health Indicator
  Stage 2 — LSTM MC Dropout → RUL + P_fail
  Fault detector heuristic
  Full predict() entry point

All tests run against local inference_package/ artifacts (no MLflow, no Docker).
conftest.py::patch_model_loader populates the model_loader singletons.
"""
from __future__ import annotations

import math
from collections import deque
from datetime import datetime, timezone

import numpy as np
import pytest

from predictor.inference import (
    BearingContext,
    _build_sequence,
    _normalise_hi,
    _platt_calibrate,
    predict,
    run_ae,
    run_mc_dropout,
)
from predictor.fault_detector import detect as detect_fault
import predictor.model_loader as ml
from tests.conftest import _make_feature_dict


# ---------------------------------------------------------------------------
# Stage 1 — Autoencoder
# ---------------------------------------------------------------------------

class TestAE:
    def test_returns_positive_recon_error(self, healthy_features):
        hi_raw, _ = run_ae(healthy_features)
        assert hi_raw > 0.0

    def test_degraded_higher_recon_error(self, healthy_features, degraded_features):
        hi_healthy, _  = run_ae(healthy_features)
        hi_degraded, _ = run_ae(degraded_features)
        assert hi_degraded > hi_healthy, (
            f"Expected hi_degraded ({hi_degraded:.4f}) > hi_healthy ({hi_healthy:.4f})"
        )

    def test_deterministic_in_eval_mode(self, healthy_features):
        r1, _ = run_ae(healthy_features)
        r2, _ = run_ae(healthy_features)
        assert math.isclose(r1, r2, rel_tol=1e-6)

    def test_missing_features_imputed(self, healthy_features):
        sparse = {k: v for k, v in list(healthy_features.items())[:20]}
        hi, _ = run_ae(sparse)
        assert hi > 0.0


# ---------------------------------------------------------------------------
# Stage 1 post-processing
# ---------------------------------------------------------------------------

class TestHINormalisation:
    def test_output_bounded_0_1(self):
        buf = deque([{"hi_raw": float(i) * 0.1} for i in range(1, 16)])
        normalised = _normalise_hi(buf)
        assert all(0.0 <= v <= 1.0 for v in normalised)

    def test_flat_signal_returns_zeros(self):
        buf = deque([{"hi_raw": 0.5}] * 10)
        normalised = _normalise_hi(buf)
        assert all(v == 0.0 for v in normalised)

    def test_monotone_increase_ends_at_one(self):
        buf = deque([{"hi_raw": float(i)} for i in range(1, 11)])
        normalised = _normalise_hi(buf)
        assert math.isclose(normalised[-1], 1.0, abs_tol=1e-6)


class TestSequenceBuilder:
    def _make_buf(self, n: int = 30) -> tuple[deque, list[float]]:
        buf = deque(maxlen=30)
        for i in range(n):
            buf.append({"hi_raw": 0.01 * i, "ts_minutes": float(i), "rpm": 2100, "load_kn": 12.0})
        hi_norm = _normalise_hi(buf)
        return buf, hi_norm

    def test_shape_full_buffer(self):
        buf, hi_norm = self._make_buf(30)
        seq = _build_sequence(buf, hi_norm, max_time=2495.0)
        assert seq.shape == (30, 6)

    def test_shape_partial_buffer_padded(self):
        buf, hi_norm = self._make_buf(10)
        seq = _build_sequence(buf, hi_norm, max_time=2495.0)
        assert seq.shape == (30, 6)

    def test_no_nans_or_inf(self):
        buf, hi_norm = self._make_buf(30)
        seq = _build_sequence(buf, hi_norm, max_time=2495.0)
        assert np.all(np.isfinite(seq)), "Sequence contains NaN or Inf"

    def test_time_norm_capped_at_1_5(self):
        buf = deque(maxlen=30)
        for _ in range(30):
            buf.append({"hi_raw": 0.1, "ts_minutes": 9999.0, "rpm": 2100, "load_kn": 12.0})
        hi_norm = [0.5] * 30
        seq = _build_sequence(buf, hi_norm, max_time=2495.0)
        assert np.all(seq[:, 5] <= 1.5 + 1e-6)


# ---------------------------------------------------------------------------
# Stage 2 — MC Dropout
# ---------------------------------------------------------------------------

class TestMCDropout:
    @pytest.fixture()
    def typical_sequence(self):
        buf = deque(maxlen=30)
        for i in range(30):
            buf.append({"hi_raw": 0.01 * i, "ts_minutes": float(i), "rpm": 2100, "load_kn": 12.0})
        hi_norm = _normalise_hi(buf)
        return _build_sequence(buf, hi_norm, max_time=2495.0)

    def test_rul_nonnegative(self, typical_sequence):
        result = run_mc_dropout(typical_sequence, n_passes=20)
        assert result["rul_mean"] >= 0.0

    def test_rul_within_max(self, typical_sequence):
        result = run_mc_dropout(typical_sequence, n_passes=20)
        assert result["rul_mean"] <= ml.rul_scaler["max_rul"] + 1.0

    def test_ci_ordering(self, typical_sequence):
        result = run_mc_dropout(typical_sequence, n_passes=20)
        assert result["rul_lower"] <= result["rul_mean"] <= result["rul_upper"]

    def test_nonzero_std_mc_active(self, typical_sequence):
        result = run_mc_dropout(typical_sequence, n_passes=30)
        assert result["rul_std"] > 0.0, "MC Dropout should produce variance across passes"

    def test_pfail_raw_in_0_1(self, typical_sequence):
        result = run_mc_dropout(typical_sequence, n_passes=20)
        assert 0.0 <= result["pfail_raw"] <= 1.0

    def test_ood_flag_is_bool(self, typical_sequence):
        result = run_mc_dropout(typical_sequence, n_passes=20)
        assert isinstance(result["ood_flag"], bool)


# ---------------------------------------------------------------------------
# Platt calibration
# ---------------------------------------------------------------------------

class TestPlattCalibration:
    @pytest.mark.parametrize("pfail_raw", [0.1, 0.3, 0.5, 0.7, 0.9])
    def test_output_in_0_1(self, pfail_raw):
        result = _platt_calibrate(pfail_raw)
        assert 0.0 <= result <= 1.0

    def test_monotone_increasing(self):
        vals = [_platt_calibrate(p) for p in np.linspace(0.01, 0.99, 20)]
        assert all(vals[i] <= vals[i + 1] for i in range(len(vals) - 1))

    def test_boundary_safe(self):
        assert 0.0 <= _platt_calibrate(0.0) <= 1.0
        assert 0.0 <= _platt_calibrate(1.0) <= 1.0


# ---------------------------------------------------------------------------
# Fault detector
# ---------------------------------------------------------------------------

class TestFaultDetector:
    def _feat(self, **kwargs) -> dict[str, float]:
        base = {"kurtosis": 2.0, "crest_factor": 2.0, "rms": 0.5,
                "spectral_entropy": 0.4, "shape_factor": 1.3, "hi": 0.1}
        base.update(kwargs)
        return base

    def test_inner_race(self):
        ft, conf = detect_fault(self._feat(kurtosis=6.0, crest_factor=5.5))
        assert ft == "INNER_RACE"
        assert 0.0 < conf <= 1.0

    def test_outer_race(self):
        ft, conf = detect_fault(self._feat(kurtosis=4.0, rms=2.0))
        assert ft == "OUTER_RACE"
        assert 0.0 < conf <= 1.0

    def test_ball(self):
        ft, conf = detect_fault(self._feat(kurtosis=3.6, spectral_entropy=0.85))
        assert ft == "BALL"
        assert 0.0 < conf <= 1.0

    def test_cage(self):
        ft, conf = detect_fault(self._feat(kurtosis=2.0, rms=0.3, shape_factor=2.0))
        assert ft == "CAGE"
        assert 0.0 < conf <= 1.0

    def test_unknown_healthy(self):
        ft, conf = detect_fault(self._feat(hi=0.05))
        assert ft == "UNKNOWN"
        assert conf >= 0.0

    def test_confidence_bounded_all_inputs(self, healthy_features, degraded_features):
        for feats in (healthy_features, degraded_features):
            _, conf = detect_fault(feats)
            assert 0.0 <= conf <= 1.0


# ---------------------------------------------------------------------------
# Full predict() pipeline
# ---------------------------------------------------------------------------

class TestPredict:
    def test_returns_prediction_record(self, sample_feature_record):
        from shared.schemas import PredictionRecord
        ctx = BearingContext(rpm=2100, load_kn=12.0, elapsed_minutes=60.0)
        result = predict(sample_feature_record, ctx)
        assert isinstance(result, PredictionRecord)

    def test_all_fields_present(self, sample_feature_record):
        ctx = BearingContext(rpm=2100, load_kn=12.0, elapsed_minutes=60.0)
        r = predict(sample_feature_record, ctx)
        assert r.rul_minutes >= 0.0
        assert r.rul_lower_minutes is not None
        assert r.rul_upper_minutes is not None
        assert 0.0 <= r.p_fail <= 1.0
        assert 0.0 <= r.health_score <= 100.0
        assert r.bearing_id == "Bearing2_4"
        assert r.file_idx == 10

    def test_health_score_consistent_with_p_fail(self, sample_feature_record):
        ctx = BearingContext(rpm=2100, load_kn=12.0, elapsed_minutes=60.0)
        r = predict(sample_feature_record, ctx)
        assert math.isclose(r.health_score, round((1.0 - r.p_fail) * 100.0, 2), abs_tol=0.01)

    def test_ci_width_positive(self, sample_feature_record):
        ctx = BearingContext(rpm=2100, load_kn=12.0, elapsed_minutes=60.0)
        r = predict(sample_feature_record, ctx)
        assert r.rul_upper_minutes > r.rul_lower_minutes

    def test_degraded_higher_pfail_than_healthy(self, sample_feature_record, degraded_feature_record):
        ctx = BearingContext(rpm=2100, load_kn=12.0, elapsed_minutes=60.0)
        r_h = predict(sample_feature_record, ctx)
        r_d = predict(degraded_feature_record, ctx)
        assert r_d.p_fail >= r_h.p_fail, (
            f"Degraded p_fail ({r_d.p_fail:.4f}) should be >= healthy ({r_h.p_fail:.4f})"
        )

    def test_model_version_nonempty(self, sample_feature_record):
        ctx = BearingContext(rpm=2100, load_kn=12.0, elapsed_minutes=60.0)
        r = predict(sample_feature_record, ctx)
        assert r.model_version != ""

    def test_sliding_window_35_steps_no_crash(self):
        """Feed 35 consecutive records — window rolls correctly, no error."""
        from shared.schemas import FeatureRecord
        for i in range(35):
            feat = _make_feature_dict(seed=i, degraded=(i > 25))
            feat["elapsed_minutes"] = float(i)
            rec = FeatureRecord(
                bearing_id="Bearing_window_test",
                file_idx=i + 1,
                sample_ts=datetime(2026, 1, 1, tzinfo=timezone.utc),
                lifetime_pct=i / 35,
                features=feat,
            )
            ctx = BearingContext(rpm=2100, load_kn=12.0, elapsed_minutes=float(i))
            result = predict(rec, ctx)
            assert result.rul_minutes >= 0.0
