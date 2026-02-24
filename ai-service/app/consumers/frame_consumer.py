"""
FrameConsumer — consumes messages from the `frame.analysis` queue.

Message format (JSON):
{
    "sessionId":  "uuid-string",
    "frameData":  "<base64-encoded JPEG>",
    "timestamp":  1234567890          // epoch millis
}

Processing pipeline:
  1. Decode base64 JPEG → numpy BGR frame
  2. Run face_monitor, gaze_tracker, mouth_monitor, object_detector in sequence
  3. Calculate composite risk via risk_aggregator
  4. For each HIGH/CRITICAL event: save annotated snapshot to MinIO
  5. Publish one result message per violation to `proctoring.results`
"""
from __future__ import annotations

import base64
import json
import logging
import uuid
from io import BytesIO
from typing import Any

import numpy as np
import pika

from app.consumers.base_consumer import BaseConsumer
from app.ml.risk_aggregator import VisionResult, score_frame, RiskResult
from app.modules import face_monitor, gaze_tracker, mouth_monitor, object_detector
from app.publisher.result_publisher import publish_result
from app.storage.minio_client import MinioClient

logger = logging.getLogger(__name__)

QUEUE_NAME = "frame.analysis"


class FrameConsumer(BaseConsumer):
    """Processes video frame analysis requests."""

    @property
    def queue_name(self) -> str:
        return QUEUE_NAME

    def process_message(self, body: bytes, properties: pika.BasicProperties) -> None:
        msg = json.loads(body)
        session_id = msg.get("sessionId", "unknown")
        frame_b64  = msg.get("frameData", "")
        timestamp  = msg.get("timestamp",  0)

        # ── Decode frame ──────────────────────────────────────────────────
        try:
            import cv2
            raw = base64.b64decode(frame_b64)
            arr = np.frombuffer(raw, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("cv2.imdecode returned None")
        except Exception as exc:
            logger.warning("Cannot decode frame for session %s: %s", session_id, exc)
            return

        # ── Run all vision modules ─────────────────────────────────────────
        face_result   = face_monitor.analyze(frame)
        gaze_result   = gaze_tracker.analyze(frame)
        mouth_result  = mouth_monitor.analyze(frame)
        object_result = object_detector.analyze(frame)

        vision = VisionResult(
            face_present     = face_result["face_present"],
            face_count       = face_result["face_count"],
            gaze_off_screen  = gaze_result["gaze_off_screen"],
            eyes_closed      = gaze_result["eyes_closed"],
            mouth_open       = mouth_result["mouth_open"],
            phone_detected   = object_result["phone_detected"],
            notes_detected   = object_result["notes_detected"],
            extra_person     = object_result["extra_person"],
            # Forward real confidence scores so score_frame() uses them (Issue 44)
            phone_confidence = object_result["phone_confidence"],
            notes_confidence = object_result["notes_confidence"],
        )

        risk: RiskResult = score_frame(vision)

        # Only publish when there is a genuine violation
        if not risk.violations:
            return

        # ── Save snapshot to MinIO ──────────────────────────────────────────
        snapshot_path: str | None = None
        if risk.severity in ("HIGH", "CRITICAL"):
            try:
                _, jpeg_bytes = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                bucket = "proctoring-snapshots"
                object_key = f"{session_id}/{uuid.uuid4().hex}.jpg"
                snapshot_path = MinioClient.upload_bytes(
                    bucket     = bucket,
                    object_key = object_key,
                    data       = jpeg_bytes.tobytes(),
                    content_type="image/jpeg",
                )
            except Exception as exc:
                logger.warning("Snapshot upload failed for session %s: %s", session_id, exc)

        # ── Publish one result per violation ──────────────────────────────
        for violation in risk.violations:
            meta: dict[str, Any] = {
                "head_yaw":        gaze_result.get("head_yaw"),
                "head_pitch":      gaze_result.get("head_pitch"),
                "face_count":      face_result["face_count"],
                "phone_confidence":object_result["phone_confidence"],
                "notes_confidence":object_result["notes_confidence"],
                "lip_ratio":       mouth_result["lip_ratio"],
            }
            publish_result(
                session_id   = session_id,
                event_type   = violation["event_type"],
                severity     = violation["severity"],
                confidence   = violation["confidence"],
                description  = violation["description"],
                snapshot_path= snapshot_path,
                risk_score   = risk.risk_score,
                metadata     = meta,
            )
