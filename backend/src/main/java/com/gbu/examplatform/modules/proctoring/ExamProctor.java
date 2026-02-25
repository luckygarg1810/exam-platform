package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/**
 * Join table: exam_proctors
 * One exam can have multiple proctors; one proctor can be assigned to multiple
 * exams — but never two exams with overlapping time windows (enforced in
 * ExamProctorService).
 */
@Entity
@Table(name = "exam_proctors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@IdClass(ExamProctor.ExamProctorId.class)
public class ExamProctor {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proctor_id", nullable = false)
    private User proctor;

    @CreationTimestamp
    @Column(name = "assigned_at", updatable = false)
    private Instant assignedAt;

    /** Composite PK carrier */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExamProctorId implements Serializable {
        private UUID exam;
        private UUID proctor;
    }
}
