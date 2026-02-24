"""
Mouth Monitor — measures the vertical lip distance ratio from Face Mesh
landmarks to detect if the student is speaking (mouth open).

Output dict:
{
    "mouth_open":    bool,
    "lip_ratio":     float,   # 0.0 – ~0.15 (> threshold → open)
    "confidence":    float,
}
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# MediaPipe Face Mesh landmark indices for lip distance measurement
_UPPER_LIP_ID = 13    # inner upper lip centre
_LOWER_LIP_ID = 14    # inner lower lip centre
_LEFT_MOUTH   = 61    # left mouth corner (for face height normalisation)
_RIGHT_MOUTH  = 291   # right mouth corner

_face_mesh = None


def _get_face_mesh():
    global _face_mesh
    if _face_mesh is None:
        import mediapipe as mp
        _face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    return _face_mesh


def analyze(frame_bgr: np.ndarray) -> dict[str, Any]:
    """Return mouth-open detection result for a single BGR frame."""
    try:
        import mediapipe as mp   # noqa: F401
    except ImportError:
        return _default_result()

    h, w = frame_bgr.shape[:2]

    try:
        mesh = _get_face_mesh()
        frame_rgb = frame_bgr[:, :, ::-1]
        results = mesh.process(frame_rgb)

        if not results.multi_face_landmarks:
            return _default_result()

        lm = results.multi_face_landmarks[0].landmark

        upper_y = lm[_UPPER_LIP_ID].y * h
        lower_y = lm[_LOWER_LIP_ID].y * h
        lip_dist = abs(lower_y - upper_y)

        # Normalise by inter-mouth-corner distance (face width proxy)
        left_x  = lm[_LEFT_MOUTH].x  * w
        right_x = lm[_RIGHT_MOUTH].x * w
        face_width = abs(right_x - left_x) + 1e-6

        lip_ratio = lip_dist / face_width
        mouth_open = lip_ratio > settings.lip_distance_threshold

        return {
            "mouth_open": mouth_open,
            "lip_ratio":  round(float(lip_ratio), 4),
            "confidence": 0.75 if mouth_open else 0.0,
        }

    except Exception as exc:
        logger.warning("MouthMonitor.analyze error: %s", exc)
        return _default_result()


def _default_result() -> dict[str, Any]:
    return {"mouth_open": False, "lip_ratio": 0.0, "confidence": 0.0}
