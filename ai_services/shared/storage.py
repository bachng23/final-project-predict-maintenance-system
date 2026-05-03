from __future__ import annotations

import asyncio
import io
import logging
from typing import Optional

import numpy as np
from minio import Minio
from minio.error import S3Error

from shared.config import settings

logger = logging.getLogger(__name__)

_client: Minio | None = None


# Client
def get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.MINIO_USER,
            secret_key=settings.MINIO_PASSWORD,
            secure=settings.MINIO_SECURE,
        )
        logger.info("MinIO client created")
    return _client


# Object key helpers
def _signal_key(bearing_id: str, file_idx: int) -> str:
    """raw-signals/{bearing_id}/{file_idx:05d}.npy"""

    return f"{bearing_id}/{file_idx:05d}.npy"


def _feature_key(bearing_id: str, file_idx: int) -> str:
    """features/{bearing_id}/{file_idx:05d}.npy"""

    return f"features/{bearing_id}/{file_idx:05d}.npy"


# Signal window - raw vibration data
async def upload_signal(
    bearing_id: str, 
    file_idx: int, 
    signal: np.ndarray,
) -> str:
    """Upload a raw signal array to MinIO."""
    
    key = _signal_key(bearing_id, file_idx)
    buf = io.BytesIO()
    np.save(buf, signal)
    buf_bytes = buf.getvalue()

    def _upload() -> None:
        client = get_client()
        client.put_object(
            settings.MINIO_BUCKET_RAW_SIGNALS,
            key,
            io.BytesIO(buf_bytes),
            length=len(buf_bytes),
            content_type="application/octet-stream",
        )

    await asyncio.to_thread(_upload)
    logger.debug(f"Uploaded signal to MinIO: {key}")
    return key


async def download_signal(bearing_id: str, file_idx: int) -> Optional[np.ndarray]:
    """Download a raw signal array from MinIO, return None if not found."""
    
    key = _signal_key(bearing_id, file_idx)

    def _download() -> Optional[bytes]:
        client = get_client()
        try:
            response = client.get_object(settings.MINIO_BUCKET_RAW_SIGNALS, key)
            return response.read()
        except S3Error as e:
            if e.code == "NoSuchKey":
                return None
            raise

    raw = await asyncio.to_thread(_download)
    if raw is None:
        return None
    return np.load(io.BytesIO(raw))


# Feature vector - extracted features from raw signals
async def upload_features(
    bearing_id: str, 
    file_idx: int, 
    feature_vector: np.ndarray,
) -> str:
    """Upload a feature vector to MinIO."""
    
    key = _feature_key(bearing_id, file_idx)
    buf = io.BytesIO()
    np.save(buf, feature_vector)
    buf_bytes = buf.getvalue()

    def _upload() -> None:
        client = get_client()
        client.put_object(
            settings.MINIO_BUCKET_MLFLOW,
            key,
            io.BytesIO(buf_bytes),
            length=len(buf_bytes),
            content_type="application/octet-stream",
        )

    await asyncio.to_thread(_upload)
    logger.debug(f"Uploaded features to MinIO: {key}")
    return key


async def download_features(bearing_id: str, file_idx: int) -> Optional[np.ndarray]:
    """Download a feature vector from MinIO, return None if not found."""
    
    key = _feature_key(bearing_id, file_idx)

    def _download() -> Optional[bytes]:
        client = get_client()
        try:
            response = client.get_object(settings.MINIO_BUCKET_MLFLOW, key)
            return response.read()
        except S3Error as e:
            if e.code == "NoSuchKey":
                return None
            raise

    raw = await asyncio.to_thread(_download)
    if raw is None:
        return None
    return np.load(io.BytesIO(raw))


# Bucket init (called once at service startup)
async def ensure_buckets() -> None:
    """Create a bucket if it doesn't exist. Call in lifespan startup."""
    
    buckets = [settings.MINIO_BUCKET_RAW_SIGNALS]

    def _ensure() -> None:
        client = get_client()
        for bucket in buckets:
            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)
                logger.info(f"Created MinIO bucket: {bucket}")
    
    await asyncio.to_thread(_ensure)