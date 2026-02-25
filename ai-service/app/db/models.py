"""
SQLAlchemy ORM models.

Read-only models (no write from AI service):
  - proctoring_events, violations_summary → written by Spring Boot ResultConsumer
    to avoid dual-write race conditions.

Write models (AI service is sole writer):
  - behavior_events → raw browser/OS event log; written here because Spring Boot
    never sees the raw behavior queue messages.
"""
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.database import Base


class ExamSession(Base):
    """Mapped to exam_sessions — used to verify session existence and
    retrieve the linked user for identity checks."""
    __tablename__ = "exam_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id = Column(UUID(as_uuid=True), nullable=False)
    started_at = Column(DateTime(timezone=True))
    submitted_at = Column(DateTime(timezone=True))
    last_heartbeat_at = Column(DateTime(timezone=True))
    identity_verified = Column(Boolean, default=False)
    is_suspended = Column(Boolean, default=False)
    suspension_reason = Column(String(255))
    ip_address = Column(String(50))
    user_agent = Column(Text)
    # score / is_passed / version intentionally omitted (not needed by AI)


class ExamEnrollment(Base):
    """Mapped to exam_enrollments — join point between session and user."""
    __tablename__ = "exam_enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(String(20))
    enrolled_at = Column(DateTime(timezone=True))


class User(Base):
    """Mapped to users — used to fetch id_photo_path for identity verification."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100))
    email = Column(String(150), unique=True)
    role = Column(String(20))
    profile_photo_path = Column(String(512))
    id_photo_path = Column(String(512))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True))


class BehaviorEvent(Base):
    """
    Mapped to behavior_events — written by BehaviorConsumer for every
    discrete browser/OS event (TAB_SWITCH, COPY_PASTE, etc.).

    This is the primary source of real-world training data for the
    XGBoost behaviour-risk classifier.
    """
    __tablename__ = "behavior_events"

    id             = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id     = Column(UUID(as_uuid=True), nullable=False)
    event_type     = Column(String(50), nullable=False)
    timestamp      = Column(DateTime(timezone=True), nullable=False)
    event_metadata = Column("metadata", JSONB, nullable=True)
