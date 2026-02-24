package com.gbu.examplatform.modules.proctoring;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "proctoring_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProctoringEvent {

    // Matches BIGSERIAL in V7 migration
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 50)
    private EventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Severity severity = Severity.MEDIUM;

    @Column
    private Double confidence;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "snapshot_path", length = 512)
    private String snapshotPath;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private EventSource source = EventSource.AI;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public enum EventType {
        // Vision events (AI)
        FACE_MISSING, MULTIPLE_FACES, GAZE_AWAY, MOUTH_OPEN,
        PHONE_DETECTED, NOTES_DETECTED,
        // Audio events (AI)
        AUDIO_SPEECH,
        // Browser/behavior events
        TAB_SWITCH, FULLSCREEN_EXIT, COPY_PASTE,
        // Manual/system
        MANUAL_FLAG, IDENTITY_MISMATCH
    }

    public enum Severity {
        LOW, MEDIUM, HIGH, CRITICAL
    }

    public enum EventSource {
        AI, BROWSER, SYSTEM, MANUAL
    }
}
