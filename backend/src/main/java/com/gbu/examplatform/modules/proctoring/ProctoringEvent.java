package com.gbu.examplatform.modules.proctoring;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "proctoring_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProctoringEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 50)
    private EventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Severity severity = Severity.MEDIUM;

    @Column(precision = 4, scale = 3)
    private Double confidence;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "snapshot_path", length = 255)
    private String snapshotPath;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private java.util.Map<String, Object> metadata;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private EventSource source = EventSource.AI;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public enum EventType {
        FACE_NOT_DETECTED, MULTIPLE_FACES, PHONE_DETECTED,
        BOOK_DETECTED, GAZE_AWAY, TAB_SWITCH, COPY_PASTE,
        NOISE_DETECTED, MANUAL_FLAG, IDENTITY_MISMATCH
    }

    public enum Severity {
        LOW, MEDIUM, HIGH, CRITICAL
    }

    public enum EventSource {
        AI, MANUAL, SYSTEM
    }
}
