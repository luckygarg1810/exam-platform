package com.gbu.examplatform.modules.session;

import com.gbu.examplatform.modules.enrollment.ExamEnrollment;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "exam_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enrollment_id", nullable = false)
    private ExamEnrollment enrollment;

    @CreationTimestamp
    @Column(name = "started_at", updatable = false)
    private Instant startedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "last_heartbeat_at")
    private Instant lastHeartbeatAt;

    @Column(name = "identity_verified")
    @Builder.Default
    private Boolean identityVerified = false;

    @Column(name = "is_suspended")
    @Builder.Default
    private Boolean isSuspended = false;

    @Column(name = "suspension_reason", length = 255)
    private String suspensionReason;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @Column(precision = 6, scale = 2)
    private BigDecimal score;

    @Column(name = "is_passed")
    private Boolean isPassed;

    /**
     * Timestamp when this session was suspended. Used by reinstatement logic
     * to calculate how long the student was locked out (V19).
     */
    @Column(name = "suspended_at")
    private Instant suspendedAt;

    /**
     * When the proctor reinstates a suspended session, this is set to
     * {@code exam.endTime + suspendedDuration}, giving the student back the
     * time they lost. The scheduler respects this deadline instead of the
     * exam's global endTime for this session (V19).
     */
    @Column(name = "extended_end_at")
    private Instant extendedEndAt;
}
