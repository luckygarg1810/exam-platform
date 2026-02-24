package com.gbu.examplatform.modules.enrollment;

import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "exam_enrollments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamEnrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private EnrollmentStatus status = EnrollmentStatus.REGISTERED;

    @CreationTimestamp
    @Column(name = "enrolled_at", updatable = false)
    private Instant enrolledAt;

    public enum EnrollmentStatus {
        REGISTERED, ONGOING, COMPLETED, FLAGGED, ABSENT
    }
}
