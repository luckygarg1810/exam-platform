"""
SQLAlchemy ORM models — only the tables the AI service needs to READ from.
The AI service does NOT write proctoring_events or violations_summary directly;
those writes are handled by the Spring Boot ResultConsumer to avoid dual-write
race conditions.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID

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
