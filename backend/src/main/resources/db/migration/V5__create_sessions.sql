-- V5: Exam Sessions table
CREATE TABLE exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID REFERENCES exam_enrollments(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    identity_verified BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspension_reason VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent TEXT,
    score NUMERIC(6,2),
    is_passed BOOLEAN
);
