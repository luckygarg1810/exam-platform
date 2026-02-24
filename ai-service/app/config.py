"""
Central configuration for the AI service.
All values are read from environment variables (with sensible defaults
for docker-compose usage).
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────
    db_host:     str = "postgres"
    db_port:     int = 5432
    db_name:     str = "examdb"
    db_user:     str = "examuser"
    db_password: str = "exampass"
    database_url: str = ""              # computed below if empty

    # ── RabbitMQ ─────────────────────────────────────────────────
    rabbitmq_host:     str = "rabbitmq"
    rabbitmq_port:     int = 5672
    rabbitmq_user:     str = "examuser"
    rabbitmq_password: str = "exampass"
    rabbitmq_vhost:    str = "/"
    rabbitmq_url:      str = ""         # set directly (e.g. amqp://...) OR computed below

    # Queue / exchange names (must match RabbitMQConfig.java)
    exchange_name:       str = "proctoring.exchange"
    frame_queue:         str = "frame.analysis"
    audio_queue:         str = "audio.analysis"
    behavior_queue:      str = "behavior.events"
    results_queue:       str = "proctoring.results"
    results_routing_key: str = "proctoring.results"

    # ── MinIO ─────────────────────────────────────────────────────
    minio_endpoint:   str  = "minio:9000"
    minio_access_key: str  = "minioadmin"
    minio_secret_key: str  = "minioadmin"
    minio_secure:     bool = False

    bucket_snapshots: str = "violation-snapshots"
    bucket_audio:     str = "audio-clips"
    bucket_profiles:  str = "profile-photos"

    # ── AI Thresholds ─────────────────────────────────────────────
    face_confidence_threshold: float = 0.5
    gaze_yaw_threshold:        float = 25.0   # degrees
    gaze_pitch_threshold:      float = 25.0
    gaze_away_frame_count:     int   = 3      # consecutive frames before GAZE_AWAY event
    lip_distance_threshold:    float = 0.06   # ratio (vertical lip gap / face width)

    phone_confidence_threshold: float = 0.50
    notes_confidence_threshold: float = 0.55

    speech_ratio_threshold: float = 0.20      # > this fraction of audio is speech → violation

    high_risk_threshold: float = 0.75
    critical_threshold:  float = 0.90

    # ── Behaviour consumer ────────────────────────────────────────
    behavior_window_seconds: int = 300        # rolling feature window duration

    # ── Face recognition ─────────────────────────────────────────
    face_recognition_threshold: float = 0.6   # face_distance ≤ threshold → match
    reference_photos_bucket:    str   = "profile-photos"

    # ── Model file paths ──────────────────────────────────────────
    yolo_model_path:     str = "models/yolov8n.pt"
    xgboost_model_path:  str = "models/xgboost_behavior.pkl"

    # ── HTTP server ───────────────────────────────────────────────
    port:      int = 8001
    log_level: str = "INFO"

    # ── Post-init: compute derived URLs ──────────────────────────
    @model_validator(mode="after")
    def _fill_derived_urls(self) -> "Settings":
        if not self.database_url:
            self.database_url = (
                f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}"
            )
        if not self.rabbitmq_url:
            self.rabbitmq_url = (
                f"amqp://{self.rabbitmq_user}:{self.rabbitmq_password}"
                f"@{self.rabbitmq_host}:{self.rabbitmq_port}{self.rabbitmq_vhost}"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
