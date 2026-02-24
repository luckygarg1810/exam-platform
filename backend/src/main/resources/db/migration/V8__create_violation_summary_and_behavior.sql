-- V8: Violation Summary table
CREATE TABLE violations_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE REFERENCES exam_sessions(id),
    risk_score NUMERIC(5,4) DEFAULT 0,
    face_away_count INT DEFAULT 0,
    multiple_face_count INT DEFAULT 0,
    phone_detected_count INT DEFAULT 0,
    audio_violation_count INT DEFAULT 0,
    tab_switch_count INT DEFAULT 0,
    fullscreen_exit_count INT DEFAULT 0,
    copy_paste_count INT DEFAULT 0,
    proctor_flag BOOLEAN DEFAULT FALSE,
    proctor_note TEXT,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- V8b: Behavior Events table
CREATE TABLE behavior_events (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES exam_sessions(id),
    event_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB
);
