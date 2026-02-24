package com.gbu.examplatform.modules.exam;

import com.gbu.examplatform.modules.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "exams")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 100)
    private String subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "start_time", nullable = false)
    private Instant startTime;

    @Column(name = "end_time", nullable = false)
    private Instant endTime;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(name = "total_marks", nullable = false)
    private Integer totalMarks;

    @Column(name = "passing_marks", nullable = false)
    private Integer passingMarks;

    @Column(name = "shuffle_questions")
    @Builder.Default
    private Boolean shuffleQuestions = true;

    @Column(name = "shuffle_options")
    @Builder.Default
    private Boolean shuffleOptions = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ExamStatus status = ExamStatus.DRAFT;

    @Column(name = "allow_late_entry")
    @Builder.Default
    private Boolean allowLateEntry = false;

    @Column(name = "is_deleted")
    @Builder.Default
    private Boolean isDeleted = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public enum ExamStatus {
        DRAFT, PUBLISHED, ONGOING, COMPLETED
    }
}
