-- The confidence column was created as NUMERIC(4,3) but the entity maps it as Double (float8).
-- Convert to DOUBLE PRECISION to match the Hibernate mapping.
ALTER TABLE proctoring_events
    ALTER COLUMN confidence TYPE DOUBLE PRECISION
    USING confidence::DOUBLE PRECISION;
