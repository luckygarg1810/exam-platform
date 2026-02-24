"""
Face Monitor — detects presence and count of faces using MediaPipe's
BlazeFace model (fast, accurate, runs on CPU).

Output dict:
{
    "face_present":  bool,
    "face_count":    int,       # 0, 1, or 2+ (capped at 5 for reporting)
    "face_missing":  bool,      # True when face_count == 0
    "multiple_faces": bool,     # True when face_count >= 2
    "confidence":    float,     # max detection confidence across all faces
}
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Lazy module-level imports so missing mediapipe doesn't crash on import
_detector = None


def _get_detector():
    global _detector
    if _detector is None:
        import mediapipe as mp
        _detector = mp.solutions.face_detection.FaceDetection(
            model_selection=0,                              # short-range (<2m)
            min_detection_confidence=settings.face_confidence_threshold,
        )
    return _detector


def analyze(frame_bgr: np.ndarray) -> dict[str, Any]:
    """
    Analyze a single BGR frame for face presence.

    Returns a dict with face detection results.
    Returns safe defaults when MediaPipe is unavailable.
    """
    try:
        import mediapipe as mp
    except ImportError:
        return _default_result()

    try:
        detector = _get_detector()
        # MediaPipe expects RGB
        frame_rgb = frame_bgr[:, :, ::-1]
        results = detector.process(frame_rgb)

        if not results.detections:
            return {
                "face_present": False,
                "face_count": 0,
                "face_missing": True,
                "multiple_faces": False,
                "confidence": 0.0,
            }

        face_count = len(results.detections)
        max_conf = max(
            d.score[0] for d in results.detections
            if d.score
        )
        return {
            "face_present": True,
            "face_count": face_count,
            "face_missing": False,
            "multiple_faces": face_count >= 2,
            "confidence": round(float(max_conf), 3),
        }

    except Exception as exc:
        logger.warning("FaceMonitor.analyze error: %s", exc)
        return _default_result()


def _default_result() -> dict[str, Any]:
    return {
        "face_present": True,   # assume present to avoid false positives
        "face_count": 1,
        "face_missing": False,
        "multiple_faces": False,
        "confidence": 0.0,
    }
