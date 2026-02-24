"""
Risk Aggregator — combines outputs of all AI vision/audio modules into a
single normalised risk score (0.0 – 1.0) and a list of violation dicts.

Weighted formula (mirrors implementation plan):
    face_risk      × 0.30
    gaze_risk      × 0.20
    audio_risk     × 0.20
    object_risk    × 0.20
    behaviour_risk × 0.10   (from XGBoost or rule-based fallback)

Each component is clamped to [0, 1] before weighting.

NOTE: field names here must match what the consumer files reference:
  VisionResult  — face_present, face_count, gaze_off_screen, eyes_closed,
                  mouth_open, phone_detected, notes_detected, extra_person
  AudioResult   — speech_detected, speech_ratio
  BehaviourFeatures — tab_switches, copy_paste_count, context_menu_count,
                       fullscreen_exits, focus_loss_count, event_rate_per_min
  RiskResult    — risk_score, severity, violations (list of dicts with snake_case keys)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.config import get_settings
from app.ml.model_loader import get_models

logger = logging.getLogger(__name__)
settings = get_settings()

# ── XGBoost feature order (must match scripts/train_model.py) ────────────────
FEATURE_NAMES = [
    "tab_switches",
    "copy_paste_count",
    "context_menu_count",
    "fullscreen_exits",
    "focus_loss_count",
    "event_rate_per_min",
]


# ── Input dataclasses ─────────────────────────────────────────────────────────

@dataclass
class VisionResult:
    """Aggregated outputs from all vision modules for one frame."""
    face_present:    bool  = True
    face_count:      int   = 1
    gaze_off_screen: bool  = False
    eyes_closed:     bool  = False
    mouth_open:      bool  = False
    phone_detected:  bool  = False
    notes_detected:  bool  = False
    extra_person:    bool  = False
    # Optional raw confidence values for metadata
    phone_confidence: float = 0.0
    notes_confidence: float = 0.0


@dataclass
class AudioResult:
    """VAD result for a single audio chunk."""
    speech_detected:    bool  = False
    speech_ratio:       float = 0.0   # 0.0 – 1.0
    speech_duration_ms: float = 0.0


@dataclass
class BehaviourFeatures:
    """Rolling-window behavioural event counts."""
    tab_switches:        int   = 0
    copy_paste_count:    int   = 0
    context_menu_count:  int   = 0
    fullscreen_exits:    int   = 0
    focus_loss_count:    int   = 0
    event_rate_per_min:  float = 0.0


# ── Output dataclass ──────────────────────────────────────────────────────────

@dataclass
class RiskResult:
    """Final aggregated risk output published to proctoring.results."""
    risk_score:  float = 0.0
    severity:    str   = "NONE"               # NONE | LOW | MEDIUM | HIGH | CRITICAL
    violations: list[dict[str, Any]] = field(default_factory=list)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _severity(score: float) -> str:
    if score >= settings.critical_threshold:
        return "CRITICAL"
    if score >= settings.high_risk_threshold:
        return "HIGH"
    if score >= 0.40:
        return "MEDIUM"
    if score > 0.0:
        return "LOW"
    return "NONE"


# ── Public scoring functions ──────────────────────────────────────────────────

def score_frame(vision: VisionResult) -> RiskResult:
    """
    Compute risk score for a single camera frame and return a RiskResult.
    A violation is included only when risk level is MEDIUM, HIGH, or CRITICAL.
    """
    violations: list[dict] = []

    # ── Face risk (weight 0.30) ───────────────────────────────────────────
    face_missing   = not vision.face_present or vision.face_count == 0
    multiple_faces = vision.face_count >= 2

    if face_missing:
        face_risk = 1.0
        violations.append({
            "event_type":  "FACE_NOT_DETECTED",
            "severity":    "HIGH",
            "confidence":  0.95,
            "description": "No face detected in frame.",
        })
    elif multiple_faces:
        face_risk = 0.80
        violations.append({
            "event_type":  "MULTIPLE_FACES",
            "severity":    "HIGH",
            "confidence":  0.85,
            "description": f"{vision.face_count} faces detected in frame.",
        })
    else:
        face_risk = 0.0

    # ── Gaze risk (weight 0.20) ───────────────────────────────────────────
    if vision.gaze_off_screen:
        gaze_risk = 1.0
        violations.append({
            "event_type":  "GAZE_AWAY",
            "severity":    "MEDIUM",
            "confidence":  0.80,
            "description": "Student's gaze is off screen.",
        })
    else:
        gaze_risk = 0.0

    # ── Object risk (weight 0.20) ─────────────────────────────────────────
    object_risk = 0.0
    if vision.phone_detected:
        object_risk = max(object_risk, max(vision.phone_confidence, 0.75))
        violations.append({
            "event_type":  "PHONE_DETECTED",
            "severity":    "HIGH",
            "confidence":  round(vision.phone_confidence, 3),
            "description": f"Mobile phone detected (conf={vision.phone_confidence:.0%}).",
        })
    if vision.notes_detected:
        object_risk = max(object_risk, max(vision.notes_confidence, 0.65))
        violations.append({
            "event_type":  "NOTES_DETECTED",
            "severity":    "MEDIUM",
            "confidence":  round(vision.notes_confidence, 3),
            "description": f"Book/notes detected (conf={vision.notes_confidence:.0%}).",
        })
    if vision.extra_person:
        object_risk = max(object_risk, 0.85)
        violations.append({
            "event_type":  "MULTIPLE_PERSONS",
            "severity":    "HIGH",
            "confidence":  0.85,
            "description": "Extra person detected in frame.",
        })

    # Mouth open is LOW risk — include in violations list but low weight
    mouth_risk = 0.10 if vision.mouth_open else 0.0

    # ── Weighted sum (audio=0 here, scored separately) ────────────────────
    final_score = min(1.0, (
        face_risk    * 0.30
        + gaze_risk  * 0.20
        + 0.0        * 0.20   # audio — scored by AudioConsumer separately
        + object_risk * 0.20
        + mouth_risk * 0.10
    ))

    # Filter: only emit MEDIUM+ violations
    emittable = [
        v for v in violations
        if v["severity"] in ("MEDIUM", "HIGH", "CRITICAL")
    ]

    return RiskResult(
        risk_score = round(final_score, 4),
        severity   = _severity(final_score),
        violations = emittable,
    )


def score_audio(audio: AudioResult) -> RiskResult:
    """Return a RiskResult for one audio chunk."""
    violations: list[dict] = []

    if audio.speech_detected:
        sev = "HIGH" if audio.speech_ratio > 0.50 else "MEDIUM"
        violations.append({
            "event_type":  "SUSPICIOUS_AUDIO",
            "severity":    sev,
            "confidence":  round(audio.speech_ratio, 3),
            "description": (
                f"Speech detected ({audio.speech_ratio:.0%} of audio chunk, "
                f"{audio.speech_duration_ms:.0f} ms)."
            ),
        })
        risk_score = round(min(1.0, audio.speech_ratio), 4)
    else:
        risk_score = 0.0

    return RiskResult(
        risk_score = risk_score,
        severity   = _severity(risk_score),
        violations = violations,
    )


def score_behaviour(features: BehaviourFeatures) -> RiskResult:
    """Return a RiskResult for a behaviour feature snapshot."""
    risk = _compute_behaviour_risk(features)
    violations: list[dict] = []

    if risk >= 0.30:
        sev = _severity(risk)
        violations.append({
            "event_type":  "SUSPICIOUS_BEHAVIOR",
            "severity":    sev,
            "confidence":  round(risk, 3),
            "description": (
                f"Suspicious behaviour pattern detected "
                f"(tab_switches={features.tab_switches}, "
                f"copy_paste={features.copy_paste_count}, "
                f"rate={features.event_rate_per_min:.1f}/min)."
            ),
        })

    return RiskResult(
        risk_score = round(risk, 4),
        severity   = _severity(risk),
        violations = violations,
    )


def _compute_behaviour_risk(features: BehaviourFeatures) -> float:
    """
    Use the XGBoost model if available, otherwise apply rule-based heuristics.
    Returns a float in [0.0, 1.0].
    """
    models = get_models()

    if models.xgboost_loaded and models.xgboost is not None:
        try:
            fv = np.array([[
                features.tab_switches,
                features.copy_paste_count,
                features.context_menu_count,
                features.fullscreen_exits,
                features.focus_loss_count,
                features.event_rate_per_min,
            ]], dtype=np.float32)
            proba = models.xgboost.predict_proba(fv)
            # Binary classifier: col[1] = P(suspicious)
            return float(min(1.0, max(0.0, proba[0][1] if proba.shape[1] > 1 else proba[0][0])))
        except Exception as exc:
            logger.warning("XGBoost inference failed, using rules: %s", exc)

    # ── Rule-based fallback ────────────────────────────────────────────────
    score = 0.0
    score += min(0.40, features.tab_switches       * 0.06)
    score += min(0.25, features.copy_paste_count   * 0.05)
    score += min(0.20, features.context_menu_count * 0.04)
    score += min(0.20, features.fullscreen_exits   * 0.05)
    score += min(0.20, features.focus_loss_count   * 0.04)
    score += min(0.20, features.event_rate_per_min * 0.02)
    return min(1.0, score)
