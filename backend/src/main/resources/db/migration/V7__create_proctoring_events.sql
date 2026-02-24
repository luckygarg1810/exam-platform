-- V7: Proctoring Events table
CREATE TABLE proctoring_events (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES exam_sessions(id),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    confidence NUMERIC(4,3),
    description TEXT,
    snapshot_path VARCHAR(512),
    metadata JSONB,
    source VARCHAR(20) NOT NULL CHECK (source IN ('AI', 'BROWSER', 'SYSTEM')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
