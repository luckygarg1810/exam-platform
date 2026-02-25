"""
BaseConsumer — abstract RabbitMQ consumer with:
  • automatic reconnection / channel recovery
  • thread-safe, each consumer instance owns one connection + channel
  • configurable prefetch count
"""
from __future__ import annotations

import abc
import logging
import threading
import time
from typing import Any

import pika
import pika.exceptions

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_RECONNECT_DELAY   = 5    # seconds between reconnect attempts
_MAX_RECONNECT     = 0    # 0 = retry forever
_DEFAULT_PREFETCH  = 1    # one message at a time per consumer thread


class BaseConsumer(threading.Thread, abc.ABC):
    """
    Abstract background thread that consumes messages from a RabbitMQ queue.

    Subclasses must implement:
        queue_name: str property
        process_message(body: bytes, properties: pika.BasicProperties) -> None
    """

    daemon = True          # thread exits when main process exits

    def __init__(self, prefetch: int = _DEFAULT_PREFETCH) -> None:
        super().__init__(name=self.__class__.__name__, daemon=True)
        self._prefetch   = prefetch
        self._stop_event = threading.Event()
        self._connection: pika.BlockingConnection | None = None
        self._channel:    pika.adapters.blocking_connection.BlockingChannel | None = None

    # ── Abstract interface ──────────────────────────────────────────────────

    @property
    @abc.abstractmethod
    def queue_name(self) -> str:
        """Return the queue name to consume from."""

    @abc.abstractmethod
    def process_message(
        self,
        body:       bytes,
        properties: pika.BasicProperties,
    ) -> None:
        """Process one deserialized message body."""

    # ── Thread entry point ──────────────────────────────────────────────────

    def run(self) -> None:
        logger.info("%s starting, queue=%s", self.name, self.queue_name)
        while not self._stop_event.is_set():
            try:
                self._connect()
                self._consume_loop()
            except pika.exceptions.AMQPConnectionError as exc:
                logger.warning("%s connection lost: %s — reconnecting in %ds",
                               self.name, exc, _RECONNECT_DELAY)
                self._close_connection()
                time.sleep(_RECONNECT_DELAY)
            except Exception as exc:
                logger.error("%s unexpected error: %s — reconnecting in %ds",
                             self.name, exc, _RECONNECT_DELAY, exc_info=True)
                self._close_connection()
                time.sleep(_RECONNECT_DELAY)

    def stop(self) -> None:
        self._stop_event.set()
        self._close_connection()

    # ── Internal helpers ────────────────────────────────────────────────────

    def _connect(self) -> None:
        params = pika.URLParameters(settings.rabbitmq_url)
        params.heartbeat        = 60
        params.blocked_connection_timeout = 30
        self._connection = pika.BlockingConnection(params)
        self._channel    = self._connection.channel()

        # passive=True: just assert the queue exists; don't try to re-declare
        # with different arguments (Spring Boot owns the queue declarations).
        self._channel.queue_declare(
            queue=self.queue_name,
            passive=True,
        )
        self._channel.basic_qos(prefetch_count=self._prefetch)
        logger.info("%s connected to %s", self.name, self.queue_name)

    def _consume_loop(self) -> None:
        assert self._channel is not None
        self._channel.basic_consume(
            queue=self.queue_name,
            on_message_callback=self._on_message,
        )
        self._channel.start_consuming()

    def _on_message(
        self,
        channel,
        method:     pika.spec.Basic.Deliver,
        properties: pika.BasicProperties,
        body:       bytes,
    ) -> None:
        try:
            self.process_message(body, properties)
            channel.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as exc:
            logger.error("%s process_message failed: %s", self.name, exc, exc_info=True)
            # nack without requeue to avoid poison-message loops
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def _close_connection(self) -> None:
        try:
            if self._connection and not self._connection.is_closed:
                self._connection.close()
        except Exception:
            pass
        self._connection = None
        self._channel    = None
