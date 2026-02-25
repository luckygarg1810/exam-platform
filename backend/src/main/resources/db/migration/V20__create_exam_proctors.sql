-- V20: Admin assigns proctors to exams (many-to-many).
-- A proctor may be assigned to multiple exams but must not have overlapping
-- time windows (enforced at application layer in ExamProctorService).
CREATE TABLE exam_proctors (
    exam_id     UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    proctor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (exam_id, proctor_id)
);

CREATE INDEX idx_exam_proctors_proctor ON exam_proctors(proctor_id);
