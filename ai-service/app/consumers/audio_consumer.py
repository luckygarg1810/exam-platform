"""
AudioConsumer — consumes messages from `audio.analysis` queue.

Message format (JSON):
{
    "sessionId":  "uuid-string",
    "audioData":  "<base64-encoded WebM/Opus>",
    "timestamp":  1234567890
}

Detects speech — if speech_ratio exceeds threshold, publishes a
SUSPICIOUS_AUDIO event.
"""
from __future__ import annotations

import json
import logging

import pika

from app.consumers.base_consumer import BaseConsumer
from app.modules.audio_vad import analyze as vad_analyze
from app.publisher.result_publisher import publish_result

logger = logging.getLogger(__name__)

QUEUE_NAME = "audio.analysis"


class AudioConsumer(BaseConsumer):
    """Processes audio VAD analysis requests."""

    @property
    def queue_name(self) -> str:
        return QUEUE_NAME

    def process_message(self, body: bytes, properties: pika.BasicProperties) -> None:
        msg = json.loads(body)
        session_id = msg.get("sessionId", "unknown")
        audio_b64  = msg.get("audioData", "")
        timestamp  = msg.get("timestamp",  0)  # noqa: F841

        result = vad_analyze(audio_b64)

        if not result["speech_detected"]:
            return

        ratio = result["speech_ratio"]
        speech_dur = result["speech_duration_ms"]

        severity = "MEDIUM"
        if ratio > 0.70:
            severity = "HIGH"
        elif ratio > 0.50:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        publish_result(
            session_id   = session_id,
            event_type   = "SUSPICIOUS_AUDIO",
            severity     = severity,
            confidence   = round(ratio, 3),
            description  = (
                f"Speech detected for {speech_dur:.0f}ms "
                f"({ratio * 100:.1f}% of clip)"
            ),
            snapshot_path= None,
            risk_score   = round(ratio * 0.6, 3),
            metadata     = {
                "speech_ratio":       result["speech_ratio"],
                "speech_duration_ms": result["speech_duration_ms"],
                "total_duration_ms":  result["total_duration_ms"],
            },
        )
