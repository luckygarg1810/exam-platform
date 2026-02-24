"""
Tests for audio VAD module.
Run with: pytest ai-service/tests/test_audio_vad.py -v
"""
import base64
import os
import struct
import wave
import io

import pytest


def _make_silence_wav(duration_sec: float = 1.0, sample_rate: int = 16000) -> bytes:
    """Generate a silent WAV file as bytes."""
    n_samples = int(duration_sec * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)         # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * n_samples)
    return buf.getvalue()


def _make_sine_wav(freq: float = 440.0, duration_sec: float = 1.0, sample_rate: int = 16000) -> bytes:
    """Generate a sine-wave WAV file (simulates speech-like audio)."""
    import math
    n_samples = int(duration_sec * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        samples = [
            struct.pack("<h", int(16000 * math.sin(2 * math.pi * freq * i / sample_rate)))
            for i in range(n_samples)
        ]
        wf.writeframes(b"".join(samples))
    return buf.getvalue()


class TestAudioVADModule:
    def test_default_result_on_empty_input(self):
        """Empty base64 returns safe defaults."""
        from app.modules.audio_vad import analyze
        result = analyze("")
        assert result["speech_detected"] is False
        assert result["speech_ratio"] == 0.0

    def test_default_result_on_invalid_b64(self):
        """Invalid base64 returns safe defaults without raising."""
        from app.modules.audio_vad import analyze
        result = analyze("not-valid-base64!!!")
        assert result["speech_detected"] is False

    def test_silent_wav_no_speech(self):
        """A silent WAV should not trigger speech detection."""
        try:
            import webrtcvad  # noqa: F401
            from pydub import AudioSegment  # noqa: F401
        except ImportError:
            pytest.skip("webrtcvad or pydub not installed")

        from app.modules.audio_vad import analyze_bytes
        wav_bytes = _make_silence_wav(duration_sec=1.0)
        result    = analyze_bytes(wav_bytes)
        assert result["speech_detected"] is False
        assert result["speech_ratio"] < 0.2

    def test_result_keys_present(self):
        """Result dict always contains required keys."""
        from app.modules.audio_vad import analyze
        result = analyze(base64.b64encode(b"garbage").decode())
        for key in ("speech_detected", "speech_ratio", "speech_duration_ms", "total_duration_ms"):
            assert key in result, f"Missing key: {key}"
