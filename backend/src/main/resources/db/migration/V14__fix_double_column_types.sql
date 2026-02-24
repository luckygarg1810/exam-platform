-- questions.negative_marks was NUMERIC(3,1) but entity uses Double (float8)
ALTER TABLE questions
    ALTER COLUMN negative_marks TYPE DOUBLE PRECISION
    USING negative_marks::DOUBLE PRECISION;

-- violation_summary.risk_score was NUMERIC(5,4) but entity uses Double (float8)
ALTER TABLE violations_summary
    ALTER COLUMN risk_score TYPE DOUBLE PRECISION
    USING risk_score::DOUBLE PRECISION;
