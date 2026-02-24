-- V9: Performance indexes
CREATE INDEX idx_proctoring_session ON proctoring_events(session_id, created_at DESC);
CREATE INDEX idx_behavior_session ON behavior_events(session_id, timestamp DESC);
CREATE INDEX idx_sessions_enrollment ON exam_sessions(enrollment_id);
CREATE INDEX idx_answers_session ON answers(session_id);
CREATE INDEX idx_enrollments_user ON exam_enrollments(user_id);
CREATE INDEX idx_enrollments_exam ON exam_enrollments(exam_id);
CREATE INDEX idx_questions_exam ON questions(exam_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_users_email ON users(email);
