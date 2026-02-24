-- V3: Questions table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('MCQ', 'SHORT_ANSWER')),
    options JSONB,
    correct_answer VARCHAR(10),
    marks INT NOT NULL DEFAULT 1,
    negative_marks NUMERIC(3,1) DEFAULT 0,
    order_index INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
