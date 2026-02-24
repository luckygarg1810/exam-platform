-- Issue 36: Add optimistic locking version column to exam_sessions
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
