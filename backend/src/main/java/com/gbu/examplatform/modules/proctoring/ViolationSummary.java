package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.modules.session.ExamSession;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Matches V8 migration exactly: violations_summary table.
 * One row per exam session, updated incrementally as proctoring events arrive.
 */
@Entity
@Table(name = "violations_summary")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ViolationSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", unique = true, nullable = false)
    private ExamSession session;

    /** Normalized AI risk score 0.0 – 1.0 (updated from AI result) */
    @Column(name = "risk_score")
    @Builder.Default
    private Double riskScore = 0.0;

    @Column(name = "face_away_count")
    @Builder.Default
    private Integer faceAwayCount = 0;

    @Column(name = "multiple_face_count")
    @Builder.Default
    private Integer multipleFaceCount = 0;

    @Column(name = "phone_detected_count")
    @Builder.Default
    private Integer phoneDetectedCount = 0;

    @Column(name = "audio_violation_count")
    @Builder.Default
    private Integer audioViolationCount = 0;

    @Column(name = "tab_switch_count")
    @Builder.Default
    private Integer tabSwitchCount = 0;

    @Column(name = "fullscreen_exit_count")
    @Builder.Default
    private Integer fullscreenExitCount = 0;

    @Column(name = "copy_paste_count")
    @Builder.Default
    private Integer copyPasteCount = 0;

    /**
     * Counters for violation types that previously had no summary column (Issue 25)
     */
    @Column(name = "notes_detected_count")
    @Builder.Default
    private Integer notesDetectedCount = 0;

    @Column(name = "identity_mismatch_count")
    @Builder.Default
    private Integer identityMismatchCount = 0;

    @Column(name = "manual_flag_count")
    @Builder.Default
    private Integer manualFlagCount = 0;

    /** Counter for AI behaviour-analysis violations (Issue 39) */
    @Column(name = "suspicious_behavior_count")
    @Builder.Default
    private Integer suspiciousBehaviorCount = 0;

    /** Counter for extra-person-in-room detections (Issue 40) */
    @Column(name = "multiple_persons_count")
    @Builder.Default
    private Integer multiplePersonsCount = 0;

    /**
     * Counter for gaze-away violations — separated from faceAwayCount (Issue 41)
     */
    @Column(name = "gaze_away_count")
    @Builder.Default
    private Integer gazeAwayCount = 0;

    /**
     * Counter for mouth-open violations — separated from faceAwayCount (Issue 41)
     */
    @Column(name = "mouth_open_count")
    @Builder.Default
    private Integer mouthOpenCount = 0;

    @Column(name = "proctor_flag")
    @Builder.Default
    private Boolean proctorFlag = false;

    @Column(name = "proctor_note", columnDefinition = "TEXT")
    private String proctorNote;

    @UpdateTimestamp
    @Column(name = "last_updated_at")
    private Instant lastUpdatedAt;
}
