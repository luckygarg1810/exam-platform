"""
BehaviorConsumer — consumes messages from `behavior.events` queue.

A "behaviour event" is a discrete browser/client action (TAB_SWITCH,
COPY_PASTE, CONTEXT_MENU, FULLSCREEN_EXIT, …).  Per-session event counts
are tracked in memory (no persistence, suitable for single-instance
deployment; extend with Redis if horizontal scaling is needed).

Message format (JSON):
{
    "sessionId": "uuid-string",
    "type":      "TAB_SWITCH",        // matches BehavioralEventType enum in Java
    "timestamp": 1234567890
}

High-risk behaviour sequences trigger a SUSPICIOUS_BEHAVIOR result.
"""
from __future__ import annotations

import json
import logging
import threading
from collections import defaultdict, deque
from time import time
from typing import Any

import pika

from app.consumers.base_consumer import BaseConsumer
from app.ml.risk_aggregator import BehaviourFeatures, score_behaviour
from app.publisher.result_publisher import publish_result

logger = logging.getLogger(__name__)

QUEUE_NAME = "behavior.events"

# Keep only the last N events per session (rolling window)
_WINDOW_SIZE = 50
# Sliding window in seconds for rate calculation
_WINDOW_SECS  = 300   # 5 minutes


class BehaviorConsumer(BaseConsumer):
    """Processes discrete behaviour events and computes behaviour risk."""

    def __init__(self) -> None:
        super().__init__()
        # Per-session event history: session_id → deque[(event_type, ts)]
        self._events: dict[str, deque] = defaultdict(lambda: deque(maxlen=_WINDOW_SIZE))
        self._lock = threading.Lock()

    @property
    def queue_name(self) -> str:
        return QUEUE_NAME

    def process_message(self, body: bytes, properties: pika.BasicProperties) -> None:
        msg = json.loads(body)
        session_id  = msg.get("sessionId", "unknown")
        event_type  = msg.get("type", "UNKNOWN")
        timestamp   = msg.get("timestamp", int(time() * 1000))

        now_sec = timestamp / 1000.0

        with self._lock:
            history = self._events[session_id]
            history.append((event_type, now_sec))

            # Build feature vector from rolling window
            features = _compute_features(history, now_sec)

        risk = score_behaviour(features)

        if risk.risk_score < 0.30 and not risk.violations:
            return

        for violation in risk.violations:
            publish_result(
                session_id   = session_id,
                event_type   = violation["event_type"],
                severity     = violation["severity"],
                confidence   = violation["confidence"],
                description  = violation["description"],
                snapshot_path= None,
                risk_score   = risk.risk_score,
                metadata     = {
                    "event_type":    event_type,
                    "feature_vector": {
                        "tab_switches":       features.tab_switches,
                        "copy_paste_count":   features.copy_paste_count,
                        "context_menu_count": features.context_menu_count,
                        "fullscreen_exits":   features.fullscreen_exits,
                        "focus_loss_count":   features.focus_loss_count,
                        "event_rate_per_min": round(features.event_rate_per_min, 2),
                    },
                },
            )


def _compute_features(history: deque, now_sec: float) -> BehaviourFeatures:
    """Tally event counts from the rolling window."""
    cutoff = now_sec - _WINDOW_SECS
    recent = [(et, ts) for et, ts in history if ts >= cutoff]

    counts: dict[str, int] = defaultdict(int)
    for et, _ in recent:
        counts[et] += 1

    event_rate = len(recent) / (_WINDOW_SECS / 60.0) if recent else 0.0

    return BehaviourFeatures(
        tab_switches       = counts.get("TAB_SWITCH", 0),
        copy_paste_count   = counts.get("COPY_PASTE", 0),
        context_menu_count = counts.get("CONTEXT_MENU", 0),
        fullscreen_exits   = counts.get("FULLSCREEN_EXIT", 0),
        focus_loss_count   = counts.get("FOCUS_LOSS", 0),
        event_rate_per_min = event_rate,
    )
