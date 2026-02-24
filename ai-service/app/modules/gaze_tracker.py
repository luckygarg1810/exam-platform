"""
Gaze Tracker — estimates head pose (yaw / pitch) and gaze direction using
MediaPipe Face Mesh with 468 landmarks.

Uses OpenCV solvePnP with a canonical 3-D face model to compute Euler angles
for head orientation.  If the head is rotated beyond configurable thresholds
the student is considered to be looking away from the screen.

Output dict:
{
    "head_yaw":       float,    # degrees, positive = turned right
    "head_pitch":     float,    # degrees, positive = nodding down
    "gaze_off_screen": bool,
    "eyes_closed":    bool,
    "confidence":     float,
}
"""
from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# 3-D face model reference points (canonical, in mm, centred on nose tip)
# Indices correspond to MediaPipe Face Mesh landmark indices
_3D_MODEL_POINTS = np.array([
    (0.0,   0.0,    0.0),    # Nose tip          (1)
    (0.0,  -63.6, -12.5),    # Chin              (152)
    (-43.3, 32.7, -26.0),    # Left eye corner   (226)
    (43.3,  32.7, -26.0),    # Right eye corner  (446)
    (-28.9,-28.9, -24.1),    # Left mouth corner (57)
    (28.9, -28.9, -24.1),    # Right mouth corner(287)
], dtype=np.float64)

# Corresponding MediaPipe landmark indices
_LANDMARK_IDS = [1, 152, 226, 446, 57, 287]

# EAR (eye aspect ratio) threshold for closed-eye detection
_EAR_THRESHOLD = 0.20

# Landmark IDs for left / right eye EAR calculation
_LEFT_EYE_IDS  = [362, 385, 387, 263, 373, 380]
_RIGHT_EYE_IDS = [33,  160, 158, 133, 153, 144]

_face_mesh = None


def _get_face_mesh():
    global _face_mesh
    if _face_mesh is None:
        import mediapipe as mp
        _face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    return _face_mesh


def _eye_aspect_ratio(landmarks, eye_ids: list[int], img_h: int, img_w: int) -> float:
    """Compute EAR for a set of 6 landmark IDs."""
    pts = np.array([
        (landmarks[i].x * img_w, landmarks[i].y * img_h)
        for i in eye_ids
    ])
    # Vertical distances
    v1 = np.linalg.norm(pts[1] - pts[5])
    v2 = np.linalg.norm(pts[2] - pts[4])
    # Horizontal distance
    h  = np.linalg.norm(pts[0] - pts[3])
    return float((v1 + v2) / (2.0 * h + 1e-6))


def analyze(frame_bgr: np.ndarray) -> dict[str, Any]:
    """Analyze gaze and head pose from a single BGR frame."""
    try:
        import mediapipe as mp   # noqa: F401
        import cv2
    except ImportError:
        return _default_result()

    h, w = frame_bgr.shape[:2]

    try:
        mesh = _get_face_mesh()
        frame_rgb = frame_bgr[:, :, ::-1]
        results = mesh.process(frame_rgb)

        if not results.multi_face_landmarks:
            return _default_result()

        landmarks = results.multi_face_landmarks[0].landmark

        # ── Head pose via PnP ──────────────────────────────────────────────
        img_pts = np.array([
            (landmarks[i].x * w, landmarks[i].y * h)
            for i in _LANDMARK_IDS
        ], dtype=np.float64)

        focal_length = w
        camera_matrix = np.array([
            [focal_length, 0,            w / 2],
            [0,            focal_length, h / 2],
            [0,            0,            1    ],
        ], dtype=np.float64)
        dist_coeffs = np.zeros((4, 1))

        success, rvec, tvec = cv2.solvePnP(
            _3D_MODEL_POINTS, img_pts, camera_matrix, dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not success:
            return _default_result()

        rmat, _ = cv2.Rodrigues(rvec)
        sy = math.sqrt(rmat[0, 0] ** 2 + rmat[1, 0] ** 2)
        pitch = math.degrees(math.atan2(-rmat[2, 0], sy))
        yaw   = math.degrees(math.atan2(rmat[1, 0], rmat[0, 0]))

        gaze_off = (
            abs(yaw)   > settings.gaze_yaw_threshold
            or abs(pitch) > settings.gaze_pitch_threshold
        )

        # ── Eye closure (EAR) ─────────────────────────────────────────────
        left_ear  = _eye_aspect_ratio(landmarks, _LEFT_EYE_IDS,  h, w)
        right_ear = _eye_aspect_ratio(landmarks, _RIGHT_EYE_IDS, h, w)
        eyes_closed = (left_ear + right_ear) / 2.0 < _EAR_THRESHOLD

        return {
            "head_yaw":        round(yaw,   2),
            "head_pitch":      round(pitch, 2),
            "gaze_off_screen": gaze_off,
            "eyes_closed":     eyes_closed,
            "confidence":      0.85,
        }

    except Exception as exc:
        logger.warning("GazeTracker.analyze error: %s", exc)
        return _default_result()


def _default_result() -> dict[str, Any]:
    return {
        "head_yaw":        0.0,
        "head_pitch":      0.0,
        "gaze_off_screen": False,
        "eyes_closed":     False,
        "confidence":      0.0,
    }
