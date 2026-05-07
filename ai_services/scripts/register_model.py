from __future__ import annotations

import argparse
import json
import logging
import time
from pathlib import Path

import mlflow
from mlflow.tracking import MlflowClient

from shared.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

PACKAGE_DIR = Path(__file__).parent.parent / "inference_package"
ALIAS = "champion"

AE_MODEL_NAME = "xjtu-ae"
RUL_MODEL_NAME = "xjtu-rul"


def _wait_for_mlflow(retries: int = 10, delay: float = 5.0) -> None:
    import urllib.request
    uri = settings.mlflow_tracking_uri
    for attempt in range(1, retries + 1):
        try:
            urllib.request.urlopen(f"{uri}/health", timeout=3)
            log.info("MLflow is ready at %s", uri)
            return
        except Exception:
            log.info("MLflow not ready, attempt %d/%d — retrying in %.0fs", attempt, retries, delay)
            time.sleep(delay)
    raise RuntimeError(f"MLflow not reachable at {uri} after {retries} attempts")


def _alias_exists(client: MlflowClient, model_name: str) -> bool:
    try:
        client.get_model_version_by_alias(model_name, ALIAS)
        return True
    except mlflow.exceptions.MlflowException:
        return False


def _register_ae(client: MlflowClient, promote: bool) -> None:
    if not promote and _alias_exists(client, AE_MODEL_NAME):
        log.info("%-12s alias '%s' already exists — creating new version without promoting", AE_MODEL_NAME, ALIAS)

    log.info("Registering %s ...", AE_MODEL_NAME)
    with mlflow.start_run(run_name=f"register-{AE_MODEL_NAME}"):
        mlflow.log_artifact(str(PACKAGE_DIR / "ae_model.pt"),         artifact_path="model")
        mlflow.log_artifact(str(PACKAGE_DIR / "scaler.pkl"),           artifact_path="model")
        mlflow.log_artifact(str(PACKAGE_DIR / "imputer.pkl"),          artifact_path="model")
        mlflow.log_artifact(str(PACKAGE_DIR / "ae_feature_names.json"), artifact_path="model")

        with open(PACKAGE_DIR / "ae_feature_names.json") as f:
            meta = json.load(f)
        mlflow.log_params({
            "input_dim":  meta.get("n_features", 70),
            "latent_dim": 8,
            "dropout":    0.2,
        })

        run_id = mlflow.active_run().info.run_id

    model_uri = f"runs:/{run_id}/model"
    mv = mlflow.register_model(model_uri, AE_MODEL_NAME)
    if promote:
        client.set_registered_model_alias(AE_MODEL_NAME, ALIAS, mv.version)
        log.info("✓ %s v%s → alias '%s'", AE_MODEL_NAME, mv.version, ALIAS)
    else:
        log.info("✓ %s v%s created (not promoted)", AE_MODEL_NAME, mv.version)


def _register_rul(client: MlflowClient, promote: bool) -> None:
    if not promote and _alias_exists(client, RUL_MODEL_NAME):
        log.info("%-12s alias '%s' already exists — creating new version without promoting", RUL_MODEL_NAME, ALIAS)

    log.info("Registering %s ...", RUL_MODEL_NAME)

    with open(PACKAGE_DIR / "model_card.json") as f:
        card = json.load(f)
    with open(PACKAGE_DIR / "rul_best_params.json") as f:
        params = json.load(f)

    perf = card.get("performance", {}).get("test_overall", {})
    norm = card.get("normalisation", {})
    unc  = card.get("uncertainty", {})

    with mlflow.start_run(run_name=f"register-{RUL_MODEL_NAME}"):
        mlflow.log_artifact(str(PACKAGE_DIR / "rul_model_best.pt"),      artifact_path="model")
        mlflow.log_artifact(str(PACKAGE_DIR / "rul_best_params.json"),   artifact_path="model")
        mlflow.log_artifact(str(PACKAGE_DIR / "rul_scaler.json"),        artifact_path="model")
        mlflow.log_artifact(str(PACKAGE_DIR / "platt_calibrator.json"),  artifact_path="model")
        mlflow.log_artifact(str(PACKAGE_DIR / "model_card.json"),        artifact_path="model")

        mlflow.log_params({
            "hidden":        params.get("hidden", 64),
            "n_layers":      params.get("n_layers", 2),
            "dropout":       params.get("dropout", 0.3),
            "seq_len":       params.get("seq_len", 30),
            "input_size":    6,
            "mc_passes":     50,
            "max_rul":       norm.get("max_rul", 2495.0),
            "ood_threshold": unc.get("ood_threshold"),
        })
        mlflow.log_metrics({
            "test_mae_min":   perf.get("mae_min", 0),
            "test_f1_pfail":  perf.get("f1_pfail", 0),
            "test_auc_roc":   perf.get("auc_roc", 0),
            "ece":            unc.get("ece", 0),
        })

        run_id = mlflow.active_run().info.run_id

    model_uri = f"runs:/{run_id}/model"
    mv = mlflow.register_model(model_uri, RUL_MODEL_NAME)
    if promote:
        client.set_registered_model_alias(RUL_MODEL_NAME, ALIAS, mv.version)
        log.info("✓ %s v%s → alias '%s'", RUL_MODEL_NAME, mv.version, ALIAS)
    else:
        log.info("✓ %s v%s created (not promoted)", RUL_MODEL_NAME, mv.version)


def _promote(client: MlflowClient, model_name: str, version: int) -> None:
    """Move the champion alias to an existing version."""
    client.set_registered_model_alias(model_name, ALIAS, version)
    log.info("✓ %s v%d → alias '%s'", model_name, version, ALIAS)


def main() -> None:
    parser = argparse.ArgumentParser(description="Register inference_package artifacts to MLflow")

    sub = parser.add_subparsers(dest="cmd", required=True)

    reg = sub.add_parser("register", help="Upload artifacts and create a new version (does NOT move champion)")
    reg.add_argument("--promote", action="store_true", help="Also move champion alias to the new version")

    pro = sub.add_parser("promote", help="Move champion alias to an existing version")
    pro.add_argument("--model", choices=[AE_MODEL_NAME, RUL_MODEL_NAME], required=True)
    pro.add_argument("--version", type=int, required=True)

    args = parser.parse_args()

    _wait_for_mlflow()
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment("model-registration")
    client = MlflowClient()

    if args.cmd == "register":
        _register_ae(client, force=args.promote)
        _register_rul(client, force=args.promote)
        if not args.promote:
            log.info("New versions created. Review in MLflow UI, then run:")
            log.info("  uv run python scripts/register_model.py promote --model xjtu-rul --version <N>")

    elif args.cmd == "promote":
        _promote(client, args.model, args.version)


if __name__ == "__main__":
    main()
