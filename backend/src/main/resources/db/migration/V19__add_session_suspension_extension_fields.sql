-- V19: Per-session suspension timestamp and extended end time
-- suspended_at : set when a session is suspended; used to calculate how long
--                the student was locked out so reinstatement can compensate.
-- extended_end_at : set on reinstatement to exam.end_time + suspension_duration,
--                   giving the student back the time they lost while suspended.
ALTER TABLE exam_sessions
    ADD COLUMN suspended_at     TIMESTAMP WITH TIME ZONE,
    ADD COLUMN extended_end_at  TIMESTAMP WITH TIME ZONE;
