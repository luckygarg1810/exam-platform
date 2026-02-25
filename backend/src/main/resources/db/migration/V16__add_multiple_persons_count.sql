-- Issue 40: Add counter for extra-person-in-room detections (MULTIPLE_PERSONS).
-- ProctoringEvent.EventType now includes MULTIPLE_PERSONS and updateCounters()
-- maps it to this column.
ALTER TABLE violations_summary
    ADD COLUMN IF NOT EXISTS multiple_persons_count INT NOT NULL DEFAULT 0;
