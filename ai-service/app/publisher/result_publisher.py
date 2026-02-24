"""
Publishes proctoring results back to the RabbitMQ `proctoring.results` queue.

Spring Boot's ProctoringResultConsumer reads from this queue and:
  - Writes to proctoring_events table
  - Updates violations_summary counters
  - Pushes real-time WebSocket alerts to proctors
  - Auto-suspends sessions when riskScore > 0.90

Message Contract (must match ProctoringResultConsumer.java expected JSON):
{
    "sessionId":    "uuid-string",
    "eventType":    "PHONE_DETECTED",   # matches ProctoringEvent.EventType enum
    "severity":     "HIGH",             # LOW | MEDIUM | HIGH | CRITICAL
    "confidence":   0.87,               # 0.0 – 1.0, nullable
    "description":  "...",
    "snapshotPath": "bucket/key",       # nullable MinIO path
    "riskScore":    0.72,               # 0.0 – 1.0
    "metadata":     {}                  # optional extra data
}
"""
import json
import logging
import threading
from typing import Any

import pika
from pika.exceptions import AMQPConnectionError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Thread-local storage so each consumer thread has its own publisher connection
_local = threading.local()


def _get_channel() -> pika.adapters.blocking_connection.BlockingChannel:
    """
    Returns a per-thread pika channel, reconnecting if the connection is closed.
    Using thread-local connections avoids the thread-safety issues with pika's
    BlockingConnection.
    """
    conn: pika.BlockingConnection | None = getattr(_local, "connection", None)
    if conn is None or conn.is_closed:
        credentials = pika.PlainCredentials(
            settings.rabbitmq_user, settings.rabbitmq_password
        )
        params = pika.ConnectionParameters(
            host=settings.rabbitmq_host,
            port=settings.rabbitmq_port,
            virtual_host=settings.rabbitmq_vhost,
            credentials=credentials,
            heartbeat=60,
            blocked_connection_timeout=30,
        )
        _local.connection = pika.BlockingConnection(params)
        _local.channel = _local.connection.channel()
        # Declare the exchange (idempotent — safe to call multiple times)
        _local.channel.exchange_declare(
            exchange=settings.exchange_name,
            exchange_type="topic",
            durable=True,
        )
        logger.info("Publisher: connected to RabbitMQ (thread %s)", threading.get_ident())

    return _local.channel


def publish_result(
    session_id: str,
    event_type: str,
    severity: str,
    confidence: float | None,
    description: str,
    risk_score: float,
    snapshot_path: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """
    Publish a single proctoring result to the proctoring.results queue.
    Retries once on connection failure.
    """
    body = {
        "sessionId": session_id,
        "eventType": event_type,
        "severity": severity,
        "confidence": round(confidence, 4) if confidence is not None else None,
        "description": description,
        "snapshotPath": snapshot_path,
        "riskScore": min(1.0, max(0.0, round(risk_score, 4))),
        "metadata": metadata or {},
    }

    _publish_with_retry(body)


def _publish_with_retry(body: dict, attempts: int = 2) -> None:
    payload = json.dumps(body).encode()
    for attempt in range(1, attempts + 1):
        try:
            channel = _get_channel()
            channel.basic_publish(
                exchange=settings.exchange_name,
                routing_key=settings.results_routing_key,
                body=payload,
                properties=pika.BasicProperties(
                    content_type="application/json",
                    delivery_mode=pika.DeliveryMode.Persistent,
                ),
            )
            logger.debug(
                "Published result → sessionId=%s type=%s risk=%.2f",
                body.get("sessionId"),
                body.get("eventType"),
                body.get("riskScore", 0),
            )
            return
        except (AMQPConnectionError, Exception) as exc:
            logger.warning("Publish attempt %d/%d failed: %s", attempt, attempts, exc)
            # Reset the thread-local connection so it is recreated on next call
            _local.connection = None
            if attempt == attempts:
                logger.error(
                    "Failed to publish result after %d attempts — message dropped: %s",
                    attempts,
                    body,
                )
