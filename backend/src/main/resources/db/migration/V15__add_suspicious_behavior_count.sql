-- Issue 39: Add counter for AI behaviour-analysis violations (SUSPICIOUS_BEHAVIOR).
-- ProctoringEvent.EventType now includes SUSPICIOUS_BEHAVIOR and updateCounters()
-- maps it to this column.
ALTER TABLE violations_summary
    ADD COLUMN IF NOT EXISTS suspicious_behavior_count INT NOT NULL DEFAULT 0;
