"""
Object Detector — runs YOLOv8 inference on a frame and filters for
exam-relevant objects: mobile phones, books/notes, and extra persons.

YOLO COCO class IDs used:
  0  → person
  67 → cell phone
  73 → book

Output dict:
{
    "phone_detected":    bool,
    "phone_confidence":  float,
    "notes_detected":    bool,
    "notes_confidence":  float,
    "extra_person":      bool,   # True if ≥ 2 persons detected
    "detections":        list[dict],   # raw filtered detections
}
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.config import get_settings
from app.ml.model_loader import get_models

logger = logging.getLogger(__name__)
settings = get_settings()

# COCO class IDs
_PHONE_CLASS  = 67
_BOOK_CLASS   = 73
_PERSON_CLASS = 0


def analyze(frame_bgr: np.ndarray) -> dict[str, Any]:
    """Run YOLOv8 on a single BGR frame and return relevant detections."""
    models = get_models()

    if not models.yolo_loaded or models.yolo is None:
        return _default_result()

    try:
        results = models.yolo.predict(
            source=frame_bgr,
            conf=0.30,              # low threshold; we apply custom per-class thresholds below
            verbose=False,
            stream=False,
        )

        if not results:
            return _default_result()

        # results is a list (one per image); we pass one image so index 0
        boxes = results[0].boxes

        phone_conf   = 0.0
        notes_conf   = 0.0
        person_count = 0
        raw_dets: list[dict] = []

        if boxes is not None and len(boxes):
            for box in boxes:
                cls  = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                xyxy = box.xyxy[0].tolist()
                raw_dets.append({"class_id": cls, "confidence": conf, "bbox": xyxy})

                if cls == _PHONE_CLASS:
                    phone_conf = max(phone_conf, conf)
                elif cls == _BOOK_CLASS:
                    notes_conf = max(notes_conf, conf)
                elif cls == _PERSON_CLASS:
                    person_count += 1

        phone_detected = phone_conf >= settings.phone_confidence_threshold
        notes_detected = notes_conf >= settings.notes_confidence_threshold

        return {
            "phone_detected":   phone_detected,
            "phone_confidence": round(phone_conf, 3),
            "notes_detected":   notes_detected,
            "notes_confidence": round(notes_conf, 3),
            "extra_person":     person_count >= 2,
            "detections":       raw_dets,
        }

    except Exception as exc:
        logger.warning("ObjectDetector.analyze error: %s", exc)
        return _default_result()


def _default_result() -> dict[str, Any]:
    return {
        "phone_detected":   False,
        "phone_confidence": 0.0,
        "notes_detected":   False,
        "notes_confidence": 0.0,
        "extra_person":     False,
        "detections":       [],
    }
