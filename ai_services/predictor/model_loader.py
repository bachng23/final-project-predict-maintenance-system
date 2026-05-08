from __future__ import annotations

import json
import logging
import time

import joblib
from pathlib import Path

import mlflow
import torch
import torch.nn as nn

from shared.config import settings

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model architecture definitions — must match training code exactly
# ---------------------------------------------------------------------------

class HealthIndicatorAE(nn.Module):
    def __init__(self, input_dim: int = 70, latent_dim: int = 8, dropout: float = 0.2):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 64), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(64, 32),        nn.ReLU(),
            nn.Linear(32, latent_dim),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 32), nn.ReLU(),
            nn.Linear(32, 64),         nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(64, input_dim),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        z = self.encoder(x)
        return self.decoder(z), z

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        return self.encoder(x)


class RULPredictor(nn.Module):
    def __init__(self, input_size: int = 6, hidden: int = 64, n_layers: int = 2, dropout: float = 0.3):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden,
            num_layers=n_layers,
            dropout=dropout if n_layers > 1 else 0.0,
            bidirectional=True,
            batch_first=True,
        )
        bi_hidden = hidden * 2  # 128

        self.attn_w = nn.Linear(bi_hidden, bi_hidden)
        self.attn_v = nn.Linear(bi_hidden, 1, bias=False)

        self.fc_rul = nn.Sequential(
            nn.Linear(bi_hidden, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, 1),
        )
        self.fc_pfail = nn.Sequential(
            nn.Linear(bi_hidden, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, 1),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """x: (batch, seq_len, input_size) → (rul_logit, pfail_logit) each (batch, 1)"""
        out, _ = self.lstm(x)                          # (B, T, 128)

        # Additive attention over all timesteps
        score = self.attn_v(torch.tanh(self.attn_w(out)))   # (B, T, 1)
        alpha = torch.softmax(score, dim=1)                  # (B, T, 1)
        context = (alpha * out).sum(dim=1)                   # (B, 128)

        rul_logit   = self.fc_rul(context)    # (B, 1)
        pfail_logit = self.fc_pfail(out[:, -1, :])  # last step for pfail

        return rul_logit, pfail_logit


# ---------------------------------------------------------------------------
# Singletons — populated by load_all_models()
# ---------------------------------------------------------------------------

ae_model:       HealthIndicatorAE | None = None
ae_scaler:      object | None = None
ae_imputer:     object | None = None
ae_features:    list[str] | None = None

rul_model:      RULPredictor | None = None
rul_scaler:     dict | None = None
platt_coef:     float | None = None
platt_intercept: float | None = None
model_card:     dict | None = None


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

def _download(model_name: str, alias: str = "champion") -> Path:
    """Download model artifacts from MLflow, return local directory path."""
    uri = f"models:/{model_name}@{alias}"
    log.info("Downloading artifacts: %s", uri)
    local_dir = mlflow.artifacts.download_artifacts(uri)
    return Path(local_dir)


def _load_ae(artifact_dir: Path) -> None:
    global ae_model, ae_scaler, ae_imputer, ae_features

    with open(artifact_dir / "ae_feature_names.json") as f:
        meta = json.load(f)
    ae_features = meta["feature_names"]
    input_dim   = meta.get("n_features", len(ae_features))

    model = HealthIndicatorAE(input_dim=input_dim, latent_dim=8, dropout=0.2)
    state = torch.load(artifact_dir / "ae_model.pt", map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    ae_model = model

    ae_scaler  = joblib.load(artifact_dir / "scaler.pkl")
    ae_imputer = joblib.load(artifact_dir / "imputer.pkl")

    log.info("xjtu-ae loaded — %d input features", input_dim)


def _load_rul(artifact_dir: Path) -> None:
    global rul_model, rul_scaler, platt_coef, platt_intercept, model_card

    with open(artifact_dir / "rul_best_params.json") as f:
        params = json.load(f)
    with open(artifact_dir / "rul_scaler.json") as f:
        rul_scaler = json.load(f)
    with open(artifact_dir / "platt_calibrator.json") as f:
        platt = json.load(f)
    with open(artifact_dir / "model_card.json") as f:
        model_card = json.load(f)

    platt_coef      = platt["coef"][0][0]
    platt_intercept = platt["intercept"][0]

    model = RULPredictor(
        input_size=6,
        hidden=params.get("hidden", 64),
        n_layers=params.get("n_layers", 2),
        dropout=params.get("dropout", 0.3),
    )
    state = torch.load(artifact_dir / "rul_model_best.pt", map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.train()   # keep train mode for MC Dropout
    rul_model = model

    log.info(
        "xjtu-rul loaded — hidden=%d layers=%d dropout=%.1f",
        params.get("hidden", 64), params.get("n_layers", 2), params.get("dropout", 0.3),
    )


def _load_from_local() -> bool:
    """Load directly from inference_package/ if it exists. Returns True on success."""
    local = Path(__file__).parent.parent / "inference_package"
    if not local.exists():
        return False
    try:
        _load_ae(local)
        _load_rul(local)
        log.info("All models loaded from local inference_package/")
        return True
    except Exception as exc:
        log.warning("Local load failed: %s", exc)
        return False


def load_all_models(retries: int = 10, delay: float = 6.0) -> None:
    """
    Load models — tries local inference_package/ first, falls back to MLflow.
    """
    if _load_from_local():
        return

    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)

    for attempt in range(1, retries + 1):
        try:
            ae_dir  = _download("xjtu-ae")
            rul_dir = _download("xjtu-rul")
            _load_ae(ae_dir)
            _load_rul(rul_dir)
            log.info("All models loaded successfully from MLflow")
            return
        except Exception as exc:
            log.warning("Model load attempt %d/%d failed: %s", attempt, retries, exc)
            if attempt < retries:
                time.sleep(delay)

    raise RuntimeError("Failed to load models from MLflow after all retries")


def assert_loaded() -> None:
    """Called at request time to fail fast if models weren't loaded."""
    if any(v is None for v in (ae_model, ae_scaler, ae_imputer, rul_model, rul_scaler)):
        raise RuntimeError("Models not loaded — was load_all_models() called?")
