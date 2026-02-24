-- V4: Exam Enrollments table
CREATE TABLE exam_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id),
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'ONGOING', 'COMPLETED', 'FLAGGED', 'ABSENT')),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (exam_id, user_id)
);
