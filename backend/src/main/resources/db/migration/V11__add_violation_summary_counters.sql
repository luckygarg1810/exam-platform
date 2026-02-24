-- Issue 25: Add counters for violation types that had no summary column.
-- NOTES_DETECTED, IDENTITY_MISMATCH, and MANUAL_FLAG all previously fell
-- through to the default branch in updateCounters() without incrementing anything.
ALTER TABLE violations_summary
    ADD COLUMN IF NOT EXISTS notes_detected_count  INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS identity_mismatch_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS manual_flag_count     INT NOT NULL DEFAULT 0;
