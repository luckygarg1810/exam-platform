"""
Audio Voice Activity Detection (VAD) using webrtcvad.

Pipeline:
  Base64 WebM blob → decode → convert to 16kHz mono PCM via pydub
  → slice into 30ms frames → webrtcvad.Vad(mode=3) classifies each frame
  → compute speech_ratio

Output dict:
{
    "speech_detected":    bool,
    "speech_ratio":       float,   # 0.0 – 1.0 (fraction of frames with speech)
    "speech_duration_ms": float,
    "total_duration_ms":  float,
}
"""
from __future__ import annotations

import base64
import io
import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# VAD parameters
_SAMPLE_RATE   = 16000   # Hz — webrtcvad only supports 8/16/32/48 kHz
_FRAME_MS      = 30      # ms — webrtcvad only supports 10/20/30 ms frames
_FRAME_BYTES   = int(_SAMPLE_RATE * _FRAME_MS / 1000) * 2   # 16-bit PCM = 2 bytes/sample


def analyze(audio_b64: str) -> dict[str, Any]:
    """
    Decode and analyze a Base64-encoded WebM audio blob.
    Returns VAD result dict.  Falls back to safe defaults on any error.
    """
    try:
        raw = base64.b64decode(audio_b64)
        return _analyze_bytes(raw)
    except Exception as exc:
        logger.warning("AudioVAD.analyze failed during base64 decode: %s", exc)
        return _default_result()


def analyze_bytes(raw: bytes) -> dict[str, Any]:
    """Analyze raw audio bytes directly (used in tests)."""
    return _analyze_bytes(raw)


def _analyze_bytes(raw: bytes) -> dict[str, Any]:
    try:
        from pydub import AudioSegment
        import webrtcvad
    except ImportError as exc:
        logger.warning("Audio dependencies not available: %s", exc)
        return _default_result()

    try:
        # Load audio using pydub (supports WebM/Opus via ffmpeg)
        audio = AudioSegment.from_file(io.BytesIO(raw))

        # Normalise to 16kHz mono PCM
        audio = (
            audio
            .set_frame_rate(_SAMPLE_RATE)
            .set_channels(1)
            .set_sample_width(2)         # 16-bit
        )

        pcm = audio.raw_data
        total_ms = len(audio) * 1.0

        vad = webrtcvad.Vad(mode=3)    # mode 3 = most aggressive (fewer false positives)

        speech_frames = 0
        total_frames  = 0

        for start in range(0, len(pcm) - _FRAME_BYTES + 1, _FRAME_BYTES):
            frame = pcm[start:start + _FRAME_BYTES]
            if len(frame) < _FRAME_BYTES:
                break
            try:
                is_speech = vad.is_speech(frame, _SAMPLE_RATE)
            except Exception:
                is_speech = False
            total_frames  += 1
            speech_frames += int(is_speech)

        if total_frames == 0:
            return _default_result()

        speech_ratio    = speech_frames / total_frames
        speech_detected = speech_ratio > settings.speech_ratio_threshold
        speech_dur_ms   = speech_frames * _FRAME_MS

        return {
            "speech_detected":    speech_detected,
            "speech_ratio":       round(speech_ratio, 3),
            "speech_duration_ms": float(speech_dur_ms),
            "total_duration_ms":  float(total_ms),
        }

    except Exception as exc:
        logger.warning("AudioVAD._analyze_bytes error: %s", exc)
        return _default_result()


def _default_result() -> dict[str, Any]:
    return {
        "speech_detected":    False,
        "speech_ratio":       0.0,
        "speech_duration_ms": 0.0,
        "total_duration_ms":  0.0,
    }
