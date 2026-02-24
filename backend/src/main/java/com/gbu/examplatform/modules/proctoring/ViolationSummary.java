package com.gbu.examplatform.modules.proctoring;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

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
    @JoinColumn(name = "session_id", unique = true)
    private com.gbu.examplatform.modules.session.ExamSession session;

    @Column(name = "total_violations")
    @Builder.Default
    private Integer totalViolations = 0;

    @Column(name = "critical_count")
    @Builder.Default
    private Integer criticalCount = 0;

    @Column(name = "high_count")
    @Builder.Default
    private Integer highCount = 0;

    @Column(name = "medium_count")
    @Builder.Default
    private Integer mediumCount = 0;

    @Column(name = "low_count")
    @Builder.Default
    private Integer lowCount = 0;

    @Column(name = "risk_score", columnDefinition = "NUMERIC(6,2)")
    @Builder.Default
    private Double riskScore = 0.0;

    @Column(name = "proctor_flagged")
    @Builder.Default
    private Boolean proctorFlagged = false;

    @Column(name = "proctor_notes", columnDefinition = "TEXT")
    private String proctorNotes;
}
