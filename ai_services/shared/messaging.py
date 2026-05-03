from __future__ import annotations

import json
import logging
from typing import Callable, Awaitable

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaError

from shared.config import settings
from shared.schemas import PredictionRecord, FeatureRecord, SnapshotPayload

logger = logging.getLogger(__name__)

# Topic names
TOPIC_FEATURES = "pdm.features"
TOPIC_PREDICTIONS = "pdm.predictions"
TOPIC_SNAPSHOTS = "pdm.snapshots"


# Producer
_producer: AIOKafkaProducer | None = None

async def get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.redpanda_bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all",
            enable_idempotence=True,
        )
        await _producer.start()
        logger.info("Kafka producer started")
    return _producer

async def close_producer() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None
        logger.info("Kafka producer stopped")

async def _publish(topic: str, payload: dict, key: str | None = None) -> None:
    producer = await get_producer()
    key_bytes = key.encode("utf-8") if key else None
    try:
        await producer.send_and_wait(topic, value=payload, key=key_bytes)
        logger.debug("Published to topic=%s key=%s", topic, key)
    except KafkaError:
        logger.exception("Failed to publish to topic=%s key=%s", topic, key)
        raise


# Publish helpers
async def publish_feature(record: FeatureRecord) -> None:
    await _publish(
        TOPIC_FEATURES, 
        record.model_dump(mode="json"), 
        key=record.bearing_id,
    )

async def publish_prediction(record: PredictionRecord) -> None:
    await _publish(
        TOPIC_PREDICTIONS, 
        record.model_dump(mode="json"), 
        key=record.bearing_id,
    )

async def publish_snapshot(payload: SnapshotPayload) -> None:
    await _publish(
        TOPIC_SNAPSHOTS, 
        payload.model_dump(mode="json"), 
        key=payload.bearing_id,
    )


# Consumer factory
async def make_consumer(
    topic: str,
    group_id: str,
    auto_offset_reset: str = "latest",
) -> AIOKafkaConsumer:
    "Create a consumer for a topic. Caller is responsible for starting and stopping the consumer."

    consumer = AIOKafkaConsumer(
        topic,
        bootstrap_servers=settings.redpanda_bootstrap_servers,
        group_id=group_id,
        auto_offset_reset=auto_offset_reset,
        enable_auto_commit=False,
        value_deserializer=lambda v: v
    )
    return consumer

async def consume_loop(
    topic: str,
    group_id: str,
    handler: Callable[[bytes], Awaitable[None]],
) -> None:
    """
    This is a long-running loop.
    Consume messages from a topic and handle with the provided handler.
    """

    consumer = await make_consumer(topic, group_id)
    await consumer.start()
    logger.info(f"Consumer started: topic={topic}, group={group_id}")

    try:
        async for msg in consumer:
            try:
                await handler(msg.value)
                await consumer.commit()
            except Exception as e:
                logger.error(f"Error handling message from {topic}: {e}")
    finally:
        await consumer.stop()
        logger.info(f"Consumer stopped: topic={topic}, group={group_id}")