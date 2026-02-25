-- Issue 41: Split faceAwayCount into separate counters for FACE_MISSING, GAZE_AWAY, and MOUTH_OPEN.
-- faceAwayCount retains the FACE_MISSING mapping; new columns cover the other two violation types.
ALTER TABLE violations_summary
    ADD COLUMN IF NOT EXISTS gaze_away_count  INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS mouth_open_count INT NOT NULL DEFAULT 0;
