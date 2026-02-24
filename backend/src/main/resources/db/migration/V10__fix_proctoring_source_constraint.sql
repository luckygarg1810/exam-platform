-- V10: Allow MANUAL source in proctoring_events
-- PostgreSQL requires dropping and recreating CHECK constraints

ALTER TABLE proctoring_events
    DROP CONSTRAINT IF EXISTS proctoring_events_source_check;

ALTER TABLE proctoring_events
    ADD CONSTRAINT proctoring_events_source_check
        CHECK (source IN ('AI', 'BROWSER', 'SYSTEM', 'MANUAL'));
