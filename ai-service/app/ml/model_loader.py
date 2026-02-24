"""
Central model loader — loads all ML models once at startup and stores them
as module-level singletons so all consumer threads can share them (read-only
inference is thread-safe for all these libraries).

Usage:
    from app.ml.model_loader import get_models
    models = get_models()
    models.yolo  # ultralytics YOLO instance or None
"""
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class LoadedModels:
    yolo: Any = None           # ultralytics.YOLO
    xgboost: Any = None        # XGBClassifier / sklearn Pipeline
    face_encoder: Any = None   # face_recognition module (lazy import)
    mediapipe_available: bool = False

    # Feature scaler for XGBoost inputs (optional, serialized with model)
    feature_scaler: Any = None

    # Readiness flags
    yolo_loaded: bool = False
    xgboost_loaded: bool = False
    face_recognition_loaded: bool = False

    @property
    def face_rec_loaded(self) -> bool:
        """Alias for face_recognition_loaded (used by routes.py)."""
        return self.face_recognition_loaded

    @property
    def mediapipe_ready(self) -> bool:
        """Alias for mediapipe_available (used by routes.py)."""
        return self.mediapipe_available

    status: dict = field(default_factory=dict)


_models: LoadedModels | None = None


def load_all_models(yolo_path: str = "models/yolov8n.pt",
                    xgboost_path: str = "models/risk_classifier.pkl") -> LoadedModels:
    """
    Load YOLOv8, XGBoost risk classifier, and face_recognition.
    Failures are non-fatal — the service degrades gracefully:
      - Without YOLO  → no phone/notes detection
      - Without XGB   → rule-based behaviour risk (no ML scoring)
      - Without face  → identity verification endpoint returns 503
    """
    global _models
    m = LoadedModels()

    # ── YOLOv8 ──────────────────────────────────────────────────
    try:
        from ultralytics import YOLO
        if Path(yolo_path).exists():
            m.yolo = YOLO(yolo_path)
            m.yolo_loaded = True
            logger.info("YOLOv8 model loaded from %s", yolo_path)
        else:
            # Auto-download the nano model on first run
            logger.info("YOLOv8 weights not found at %s — downloading yolov8n …", yolo_path)
            os.makedirs(os.path.dirname(yolo_path) or ".", exist_ok=True)
            m.yolo = YOLO("yolov8n.pt")
            # Save to expected path for future restarts
            m.yolo.save(yolo_path)
            m.yolo_loaded = True
            logger.info("YOLOv8 downloaded and cached at %s", yolo_path)
    except Exception as exc:
        logger.warning("YOLOv8 load failed (object detection disabled): %s", exc)
        m.status["yolo"] = str(exc)

    # ── XGBoost risk classifier ──────────────────────────────────
    try:
        import joblib
        if Path(xgboost_path).exists():
            m.xgboost = joblib.load(xgboost_path)
            m.xgboost_loaded = True
            logger.info("XGBoost model loaded from %s", xgboost_path)
        else:
            logger.warning(
                "XGBoost model not found at %s — rule-based behaviour scoring will be used",
                xgboost_path,
            )
            m.status["xgboost"] = "model file missing"
    except Exception as exc:
        logger.warning("XGBoost load failed (rule-based fallback): %s", exc)
        m.status["xgboost"] = str(exc)

    # ── Face recognition ─────────────────────────────────────────
    try:
        import face_recognition  # noqa: F401 — just validate import
        m.face_encoder = True   # sentinel — actual calls use the module directly
        m.face_recognition_loaded = True
        logger.info("face_recognition library loaded successfully")
    except ImportError as exc:
        logger.warning("face_recognition not available (identity verification disabled): %s", exc)
        m.status["face_recognition"] = str(exc)

    # ── MediaPipe ────────────────────────────────────────────────
    try:
        import mediapipe  # noqa: F401
        m.mediapipe_available = True
        logger.info("MediaPipe loaded successfully")
    except ImportError as exc:
        logger.warning("MediaPipe not available (vision modules disabled): %s", exc)
        m.status["mediapipe"] = str(exc)

    _models = m
    return m


def get_models() -> LoadedModels:
    """Return the globally loaded models. Call load_all_models() first."""
    global _models
    if _models is None:
        _models = LoadedModels()
    return _models


# ── Convenience aliases ───────────────────────────────────────────────────────
load_models = load_all_models          # used by main.py
Models      = LoadedModels             # used by tests
