"""
Tests for the risk aggregator.
Run with: pytest ai-service/tests/test_risk_aggregator.py -v
"""
import pytest


class TestScoreFrame:
    def test_no_violations_for_clean_frame(self):
        from app.ml.risk_aggregator import VisionResult, score_frame
        vision = VisionResult(
            face_present   = True,
            face_count     = 1,
            gaze_off_screen= False,
            eyes_closed    = False,
            mouth_open     = False,
            phone_detected = False,
            notes_detected = False,
            extra_person   = False,
        )
        result = score_frame(vision)
        assert result.violations == []
        assert result.risk_score == 0.0
        assert result.severity == "NONE"

    def test_face_missing_triggers_violation(self):
        from app.ml.risk_aggregator import VisionResult, score_frame
        vision = VisionResult(
            face_present   = False,
            face_count     = 0,
            gaze_off_screen= False,
            eyes_closed    = False,
            mouth_open     = False,
            phone_detected = False,
            notes_detected = False,
            extra_person   = False,
        )
        result = score_frame(vision)
        event_types = [v["event_type"] for v in result.violations]
        assert "FACE_NOT_DETECTED" in event_types

    def test_phone_detected_triggers_high_violation(self):
        from app.ml.risk_aggregator import VisionResult, score_frame
        vision = VisionResult(
            face_present   = True,
            face_count     = 1,
            gaze_off_screen= False,
            eyes_closed    = False,
            mouth_open     = False,
            phone_detected = True,
            notes_detected = False,
            extra_person   = False,
        )
        result = score_frame(vision)
        event_types = [v["event_type"] for v in result.violations]
        assert "PHONE_DETECTED" in event_types
        phone_v = next(v for v in result.violations if v["event_type"] == "PHONE_DETECTED")
        assert phone_v["severity"] in ("HIGH", "CRITICAL")

    def test_multiple_faces_triggers_violation(self):
        from app.ml.risk_aggregator import VisionResult, score_frame
        vision = VisionResult(
            face_present   = True,
            face_count     = 2,
            gaze_off_screen= False,
            eyes_closed    = False,
            mouth_open     = False,
            phone_detected = False,
            notes_detected = False,
            extra_person   = False,
        )
        result = score_frame(vision)
        event_types = [v["event_type"] for v in result.violations]
        assert "MULTIPLE_FACES" in event_types

    def test_risk_score_range(self):
        from app.ml.risk_aggregator import VisionResult, score_frame
        for _ in range(20):
            vision = VisionResult(
                face_present   = True,
                face_count     = 1,
                gaze_off_screen= False,
                eyes_closed    = False,
                mouth_open     = False,
                phone_detected = False,
                notes_detected = False,
                extra_person   = False,
            )
            result = score_frame(vision)
            assert 0.0 <= result.risk_score <= 1.0


class TestScoreAudio:
    def test_no_violation_below_threshold(self):
        from app.ml.risk_aggregator import AudioResult, score_audio
        audio = AudioResult(speech_detected=False, speech_ratio=0.05)
        result = score_audio(audio)
        assert result.violations == []

    def test_speech_detected_triggers_violation(self):
        from app.ml.risk_aggregator import AudioResult, score_audio
        audio = AudioResult(speech_detected=True, speech_ratio=0.80)
        result = score_audio(audio)
        assert any(v["event_type"] == "SUSPICIOUS_AUDIO" for v in result.violations)


class TestScoreBehaviour:
    def test_normal_behaviour_no_violation(self):
        from app.ml.risk_aggregator import BehaviourFeatures, score_behaviour
        features = BehaviourFeatures(
            tab_switches=0, copy_paste_count=0, context_menu_count=0,
            fullscreen_exits=0, focus_loss_count=0, event_rate_per_min=0.5,
        )
        result = score_behaviour(features)
        assert result.risk_score < 0.5

    def test_heavy_tab_switching_raises_risk(self):
        from app.ml.risk_aggregator import BehaviourFeatures, score_behaviour
        features = BehaviourFeatures(
            tab_switches=15, copy_paste_count=10, context_menu_count=5,
            fullscreen_exits=5, focus_loss_count=8, event_rate_per_min=12.0,
        )
        result = score_behaviour(features)
        assert result.risk_score > 0.3
