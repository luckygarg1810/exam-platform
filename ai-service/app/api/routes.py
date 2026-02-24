"""
FastAPI route definitions for the AI service.

  GET  /health              — liveness/readiness check
  POST /ai/verify-identity  — face-recognition identity verification
"""
from __future__ import annotations

import base64
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.db.database import check_db_connection
from app.ml.model_loader import get_models
from app.storage.minio_client import MinioClient

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/health")
def health() -> dict[str, Any]:
    models = get_models()

    db_ok    = check_db_connection()
    minio_ok = _check_minio()

    status = "ok" if (db_ok and minio_ok) else "degraded"

    return {
        "status": status,
        "models": {
            "yolo_loaded":       models.yolo_loaded,
            "xgboost_loaded":    models.xgboost_loaded,
            "face_rec_loaded":   models.face_rec_loaded,
            "mediapipe_ready":   models.mediapipe_ready,
        },
        "dependencies": {
            "database": "ok" if db_ok   else "error",
            "minio":    "ok" if minio_ok else "error",
        },
    }


def _check_minio() -> bool:
    try:
        MinioClient.ensure_bucket_exists("proctoring-snapshots")
        return True
    except Exception:
        return False


# ── Identity Verification ───────────────────────────────────────────────────────

class VerifyIdentityRequest(BaseModel):
    live_selfie_base64: str      # Base64-encoded JPEG/PNG of the live selfie
    student_id:         str      # UUID of the student in the users table


class VerifyIdentityResponse(BaseModel):
    match:      bool
    confidence: float            # 0.0 – 1.0 (1 - face_distance clamped to [0,1])
    message:    str


@router.post("/ai/verify-identity", response_model=VerifyIdentityResponse)
def verify_identity(req: VerifyIdentityRequest) -> VerifyIdentityResponse:
    models = get_models()

    if not models.face_rec_loaded:
        raise HTTPException(
            status_code=503,
            detail="face-recognition model not available",
        )

    # ── Decode live selfie ─────────────────────────────────────────────────
    try:
        import face_recognition
        import numpy as np

        live_bytes = base64.b64decode(req.live_selfie_base64)
        live_img   = face_recognition.load_image_file(__import__("io").BytesIO(live_bytes))
        live_encs  = face_recognition.face_encodings(live_img)
    except Exception as exc:
        logger.warning("verify-identity: live selfie decode failed: %s", exc)
        raise HTTPException(status_code=400, detail="Cannot decode live selfie image")

    if not live_encs:
        return VerifyIdentityResponse(
            match=False, confidence=0.0, message="No face detected in submitted photo"
        )

    live_enc = live_encs[0]

    # ── Load reference photo from MinIO ───────────────────────────────────
    try:
        ref_bytes = MinioClient.download_bytes(
            bucket    = settings.reference_photos_bucket,
            object_key= f"{req.student_id}.jpg",
        )
        if ref_bytes is None:
            # Try PNG fallback
            ref_bytes = MinioClient.download_bytes(
                bucket    = settings.reference_photos_bucket,
                object_key= f"{req.student_id}.png",
            )
    except Exception as exc:
        logger.warning("verify-identity: MinIO reference photo fetch failed: %s", exc)
        raise HTTPException(status_code=404, detail="Reference photo not found for student")

    if ref_bytes is None:
        raise HTTPException(status_code=404, detail="Reference photo not found for student")

    try:
        import io
        ref_img  = face_recognition.load_image_file(io.BytesIO(ref_bytes))
        ref_encs = face_recognition.face_encodings(ref_img)
    except Exception as exc:
        logger.warning("verify-identity: reference photo decode failed: %s", exc)
        raise HTTPException(status_code=500, detail="Cannot process reference photo")

    if not ref_encs:
        raise HTTPException(status_code=422, detail="No face found in reference photo")

    # ── Compare encodings ─────────────────────────────────────────────────
    import numpy as np
    ref_enc  = ref_encs[0]
    distance = float(face_recognition.face_distance([ref_enc], live_enc)[0])

    # Convert distance to similarity (distance=0 → confidence=1.0)
    confidence = max(0.0, min(1.0, 1.0 - distance))
    threshold  = settings.face_recognition_threshold     # e.g. 0.6

    match   = distance <= threshold
    message = "Identity verified" if match else "Identity verification failed"

    logger.info(
        "verify-identity student=%s match=%s distance=%.3f",
        req.student_id, match, distance,
    )

    return VerifyIdentityResponse(match=match, confidence=round(confidence, 3), message=message)
