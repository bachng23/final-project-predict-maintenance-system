from __future__ import annotations

import json
import joblib
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest
import torch

PACKAGE_DIR = Path(__file__).parent.parent / "inference_package"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_feature_dict(seed: int = 0, degraded: bool = False) -> dict[str, float]:
    """
    Build a synthetic 70-feature dict matching ae_feature_names.json order.
    degraded=True bumps kurtosis/rms to simulate a failing bearing.
    """
    meta = json.load(open(PACKAGE_DIR / "ae_feature_names.json"))
    rng  = np.random.default_rng(seed)
    base = {name: float(rng.normal(0, 1)) for name in meta["feature_names"]}

    if degraded:
        # Simulate outer-race fault: high kurtosis, elevated RMS
        base["h_kurtosis"]       = 7.5
        base["v_kurtosis"]       = 6.8
        base["h_shape_factor"]   = 2.1
        base["h_energy_high"]    = 3.5
        base["v_energy_high"]    = 3.1

    # Add context fields used by BearingContext in app.py
    base["rpm"]              = 2100.0
    base["load_kn"]          = 12.0
    base["elapsed_minutes"]  = 60.0

    return base


# ---------------------------------------------------------------------------
# Session-scoped model loader patch
# Loads artifacts from inference_package/ directly, bypasses MLflow
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def patch_model_loader():
    """
    Populate predictor.model_loader singletons from local inference_package/.
    Runs once per test session before any test that imports inference.py.
    """
    import predictor.model_loader as ml

    # AE
    ae_meta          = json.load(open(PACKAGE_DIR / "ae_feature_names.json"))
    ml.ae_features   = ae_meta["feature_names"]
    ml.ae_scaler     = joblib.load(PACKAGE_DIR / "scaler.pkl")
    ml.ae_imputer    = joblib.load(PACKAGE_DIR / "imputer.pkl")

    ae = ml.HealthIndicatorAE(input_dim=ae_meta["n_features"])
    ae.load_state_dict(
        torch.load(PACKAGE_DIR / "ae_model.pt", map_location="cpu", weights_only=True)
    )
    ae.eval()
    ml.ae_model = ae

    # RUL
    params            = json.load(open(PACKAGE_DIR / "rul_best_params.json"))
    ml.rul_scaler     = json.load(open(PACKAGE_DIR / "rul_scaler.json"))
    platt             = json.load(open(PACKAGE_DIR / "platt_calibrator.json"))
    ml.model_card     = json.load(open(PACKAGE_DIR / "model_card.json"))
    ml.platt_coef     = platt["coef"][0][0]
    ml.platt_intercept = platt["intercept"][0]

    rul = ml.RULPredictor(
        hidden=params["hidden"],
        n_layers=params["n_layers"],
        dropout=params["dropout"],
    )
    rul.load_state_dict(
        torch.load(PACKAGE_DIR / "rul_model_best.pt", map_location="cpu", weights_only=True)
    )
    rul.train()
    ml.rul_model = rul

    yield   # tests run here

    # teardown: reset singletons so other test modules start clean if needed
    ml.ae_model = ml.ae_scaler = ml.ae_imputer = ml.ae_features = None
    ml.rul_model = ml.rul_scaler = ml.platt_coef = ml.platt_intercept = ml.model_card = None


# ---------------------------------------------------------------------------
# Reusable fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def healthy_features() -> dict[str, float]:
    return _make_feature_dict(seed=1, degraded=False)


@pytest.fixture()
def degraded_features() -> dict[str, float]:
    return _make_feature_dict(seed=2, degraded=True)


@pytest.fixture()
def sample_feature_record(healthy_features):
    from shared.schemas import FeatureRecord
    return FeatureRecord(
        bearing_id="Bearing2_4",
        file_idx=10,
        sample_ts=datetime(2026, 1, 1, tzinfo=timezone.utc),
        lifetime_pct=0.25,
        features=healthy_features,
    )


@pytest.fixture()
def degraded_feature_record(degraded_features):
    from shared.schemas import FeatureRecord
    return FeatureRecord(
        bearing_id="Bearing2_4",
        file_idx=35,
        sample_ts=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        lifetime_pct=0.85,
        features=degraded_features,
    )
