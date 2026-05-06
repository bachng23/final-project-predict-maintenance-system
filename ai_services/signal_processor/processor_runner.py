from __future__ import annotations

import asyncio
import logging
import signal
import sys

from shared.messaging import TOPIC_VIBRATION_RAW, consume_loop

from signal_processor.consumer import handle_vibration_message

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

_shutdown = asyncio.Event()


def _handle_signal(sig: signal.Signals) -> None:
    logger.info("Received %s — initiating graceful shutdown.", sig.name)
    _shutdown.set()


async def main() -> None:
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _handle_signal, sig)

    logger.info("Signal processor starting — consuming topic '%s'", TOPIC_VIBRATION_RAW)

    consumer_task = asyncio.create_task(
        consume_loop(
            topic=TOPIC_VIBRATION_RAW,
            group_id="signal-processor-group",
            handler=handle_vibration_message,
        )
    )

    # Wait until shutdown signal or consumer exits on its own
    await asyncio.wait(
        [consumer_task, asyncio.create_task(_shutdown.wait())],
        return_when=asyncio.FIRST_COMPLETED,
    )

    if not consumer_task.done():
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass

    logger.info("Signal processor stopped.")
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
