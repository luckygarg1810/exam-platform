"""
FastAPI application entry point.

Lifespan:
  startup  → load ML models → start RabbitMQ consumer threads
  shutdown → stop consumer threads gracefully
"""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from app.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────
    logger.info("AI Service starting up …")

    # 1. Pre-load all ML models (blocks until done; enables warm first inference)
    from app.ml.model_loader import load_models
    load_models()

    # 2. Start RabbitMQ consumer threads
    from app.consumers.frame_consumer    import FrameConsumer
    from app.consumers.audio_consumer    import AudioConsumer
    from app.consumers.behavior_consumer import BehaviorConsumer

    consumers = [
        FrameConsumer(),
        AudioConsumer(),
        BehaviorConsumer(),
    ]
    for c in consumers:
        c.start()
        logger.info("Started consumer thread: %s", c.name)

    app.state.consumers = consumers

    yield

    # ── Shutdown ───────────────────────────────────────────────────────────
    logger.info("AI Service shutting down …")
    for c in app.state.consumers:
        c.stop()


def create_app() -> FastAPI:
    app = FastAPI(
        title       = "Exam Platform AI Service",
        description = "Proctoring vision, audio, and behaviour analysis",
        version     = "1.0.0",
        lifespan    = lifespan,
    )

    from app.api.routes import router
    app.include_router(router)

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host   = "0.0.0.0",
        port   = settings.port,
        reload = False,
        workers= 1,       # consumers are threads — more workers = duplicated threads
    )
