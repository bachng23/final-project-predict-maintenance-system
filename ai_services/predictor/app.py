from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from predictor import model_loader as ml
from predictor.fault_detector import detect as detect_fault
from predictor.inference import BearingContext, predict
from shared.cache import cache_prediction
from shared.database import close_pool, upsert_prediction
from shared.messaging import close_producer, publish_prediction
from shared.schemas import FeatureRecord, PredictionRecord

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ml.load_all_models()
    yield
    await close_pool()
    await close_producer()


app = FastAPI(title="Predictor Service", lifespan=lifespan)


@app.get("/health")
async def health():
    loaded = ml.rul_model is not None and ml.ae_model is not None
    version = ml.model_card.get("version", "unknown") if ml.model_card else "not loaded"
    return {"status": "ok" if loaded else "loading", "model_version": version}


@app.post("/predict", response_model=PredictionRecord)
async def predict_endpoint(record: FeatureRecord):
    if ml.rul_model is None:
        raise HTTPException(503, "Models not yet loaded")

    # Build bearing context from features (signal_processor sets rpm/load via condition metadata)
    ctx = BearingContext(
        rpm=record.features.get("rpm", 2100),
        load_kn=record.features.get("load_kn", 12.0),
        elapsed_minutes=record.features.get("elapsed_minutes", 0.0),
    )

    prediction = predict(record, ctx)

    # Append fault detection + propagate MinIO refs from FeatureRecord
    fault_type, fault_conf = detect_fault(record.features)
    prediction = prediction.model_copy(update={
        "fault_type": fault_type,
        "fault_confidence": fault_conf,
        "signal_window_ref": record.signal_window_ref,
        "feature_vector_ref": record.feature_vector_ref,
    })

    # Persist + forward (fire-and-forget, don't block response)
    try:
        pred_uuid = await upsert_prediction(prediction)
        log.debug("Prediction persisted: %s", pred_uuid)
    except Exception as exc:
        log.warning("DB write failed (non-fatal): %s", exc)

    try:
        await publish_prediction(prediction)
    except Exception as exc:
        log.warning("Kafka publish failed (non-fatal): %s", exc)

    try:
        await cache_prediction(prediction)
    except Exception as exc:
        log.debug("Cache write failed (non-fatal): %s", exc)

    return prediction
