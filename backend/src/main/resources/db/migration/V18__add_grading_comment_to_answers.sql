-- Issue 53: Persist the proctor's grading comment on short-answer reviews.
ALTER TABLE answers
    ADD COLUMN IF NOT EXISTS grading_comment TEXT;
