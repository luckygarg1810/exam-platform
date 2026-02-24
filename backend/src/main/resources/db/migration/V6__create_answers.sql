-- V6: Answers table
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES exam_sessions(id),
    question_id UUID REFERENCES questions(id),
    selected_answer VARCHAR(10),
    text_answer TEXT,
    marks_awarded NUMERIC(4,1),
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (session_id, question_id)
);
