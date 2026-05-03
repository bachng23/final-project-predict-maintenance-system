from __future__ import annotations

import logging
from typing import Optional

import redis.asyncio as aioredis

from shared.config import settings
from shared.schemas import PredictionRecord

logger = logging.getLogger(__name__)

_client: aioredis.Redis | None = None


# Client lifecycle
async def get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        logger.info("Redis client created")
    return _client


async def close_client() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None
        logger.info("Redis client closed")


# Key helpers

def _prediction_key(bearing_id: str, file_idx: int) -> str:
    return f"prediction:{bearing_id}:{file_idx}"

def _bearing_key(bearing_id: str) -> str:
    return f"bearing:{bearing_id}:latest"


# Prediction caching

async def cache_prediction(record: PredictionRecord) -> None:
    """Cache a prediction record in Redis by (bearing_id, file_idx)."""
    
    client = await get_client()
    key = _prediction_key(record.bearing_id, record.file_idx)

    await client.setex(
        key, 
        settings.REDIS_TTL_SECONDS, 
        record.model_dump_json(),
    )
    await client.setex(
        _bearing_key(record.bearing_id),
        settings.REDIS_TTL_SECONDS,
        record.model_dump_json(),
    )

async def get_cached_prediction(bearing_id: str, file_idx: int) -> Optional[PredictionRecord]:
    "Return a cached prediction record from cache, None if missing"

    client = await get_client()
    raw = await client.get(_prediction_key(bearing_id, file_idx))
    if raw is None:
        return None
    return PredictionRecord.model_validate_json(raw)

async def get_latest_cached_prediction(bearing_id: str) -> Optional[PredictionRecord]:
    "Return the latest cached prediction record for a bearing, None if missing"

    client = await get_client()
    raw = await client.get(_bearing_key(bearing_id))
    if raw is None:
        return None
    return PredictionRecord.model_validate_json(raw)

async def invalidate_bearing(bearing_id: str) -> None:
    "Remove all the cache of a bearing (when bearing is deactivated)"

    client = await get_client()
    pattern = f"prediction:{bearing_id}:*"
    keys = [key async for key in client.scan_iter(pattern)]
    keys.append(_bearing_key(bearing_id))
    if keys:
        await client.delete(*keys)
        logger.info(f"Invalidated {len(keys)} cache for bearing {bearing_id}")