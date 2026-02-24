"""
Tests for the object detector module (unit tests — no GPU needed).
Run with: pytest ai-service/tests/test_object_detector.py -v
"""
import numpy as np
import pytest


class TestObjectDetectorFallback:
    """When YOLO model is not loaded, analyzer returns safe defaults."""

    def test_returns_safe_defaults_when_model_unavailable(self, monkeypatch):
        from app.ml import model_loader
        from app.ml.model_loader import LoadedModels

        # Patch models to report yolo_loaded=False
        fake_models = LoadedModels()
        fake_models.yolo_loaded = False
        fake_models.yolo = None
        monkeypatch.setattr(model_loader, "_models", fake_models)

        from app.modules.object_detector import analyze
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = analyze(frame)

        assert result["phone_detected"]   is False
        assert result["notes_detected"]   is False
        assert result["extra_person"]     is False
        assert result["detections"]       == []

    def test_result_keys_present(self, monkeypatch):
        from app.ml import model_loader
        from app.ml.model_loader import LoadedModels

        fake_models = LoadedModels()
        fake_models.yolo_loaded = False
        monkeypatch.setattr(model_loader, "_models", fake_models)

        from app.modules.object_detector import analyze
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = analyze(frame)

        required_keys = [
            "phone_detected", "phone_confidence",
            "notes_detected", "notes_confidence",
            "extra_person", "detections",
        ]
        for key in required_keys:
            assert key in result, f"Missing key: {key}"
