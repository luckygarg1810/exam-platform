package com.gbu.examplatform.modules.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Centralised service for pushing real-time WebSocket notifications.
 *
 * Destinations (clients subscribe to these):
 * /queue/exam/{sessionId}/warning → amber warning banner to student
 * /queue/exam/{sessionId}/suspend → red suspension overlay (student)
 * /topic/proctor/exam/{examId}/alerts → violation alerts for assigned proctors
 * /topic/proctor/session/{sessionId} → per-session live state updates (proctor)
 * /topic/admin/alerts → system-wide violation feed (admin only)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Sends a warning message to the student's exam page.
     * Client subscribes to: /queue/exam/{sessionId}/warning
     */
    public void sendWarning(UUID sessionId, String message) {
        Map<String, Object> payload = Map.of(
                "type", "WARNING",
                "message", message,
                "timestamp", Instant.now().toString());
        messagingTemplate.convertAndSend("/queue/exam/" + sessionId + "/warning", payload);
        log.debug("Warning sent to session {}: {}", sessionId, message);
    }

    /**
     * Sends a suspension notification to the student, locking the exam UI.
     * Client subscribes to: /queue/exam/{sessionId}/suspend
     */
    public void sendSuspension(UUID sessionId, String reason) {
        Map<String, Object> payload = Map.of(
                "type", "SUSPEND",
                "reason", reason,
                "timestamp", Instant.now().toString());
        messagingTemplate.convertAndSend("/queue/exam/" + sessionId + "/suspend", payload);
        log.info("Suspension notification sent to session {}: {}", sessionId, reason);
    }

    /**
     * Pushes a violation alert scoped to a single exam.
     * Assigned proctors subscribe to: /topic/proctor/exam/{examId}/alerts
     * Admins also receive a copy on: /topic/admin/alerts
     */
    public void broadcastExamAlert(UUID examId, UUID sessionId, String eventType, String severity,
            Double confidence, String description) {
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("examId", examId.toString());
        payload.put("sessionId", sessionId.toString());
        payload.put("eventType", eventType);
        payload.put("severity", severity);
        payload.put("confidence", confidence != null ? confidence : 0.0);
        payload.put("description", description != null ? description : "");
        payload.put("timestamp", Instant.now().toString());

        // Assigned-proctor channel (scoped)
        messagingTemplate.convertAndSend("/topic/proctor/exam/" + examId + "/alerts", payload);
        // Admin system-wide channel
        messagingTemplate.convertAndSend("/topic/admin/alerts", payload);
        log.debug("Exam alert broadcast — exam={} session={} {} [{}]", examId, sessionId, eventType, severity);
    }

    /**
     * @deprecated Use {@link #broadcastExamAlert} instead.
     *             Kept for backward compatibility; sends to legacy admin channel
     *             only.
     */
    @Deprecated
    public void broadcastProctorAlert(UUID sessionId, String eventType, String severity,
            Double confidence, String description) {
        java.util.Map<String, Object> payload = Map.of(
                "sessionId", sessionId.toString(),
                "eventType", eventType,
                "severity", severity,
                "confidence", confidence != null ? confidence : 0.0,
                "description", description != null ? description : "",
                "timestamp", Instant.now().toString());
        messagingTemplate.convertAndSend("/topic/admin/alerts", payload);
        log.debug("Legacy proctor alert for session {}: {} [{}]", sessionId, eventType, severity);
    }

    /**
     * Sends a per-session live update to proctors monitoring a specific session.
     * Proctors subscribe to: /topic/proctor/session/{sessionId}
     * Called on significant session state changes: submission, suspension (Issue
     * 24).
     */
    public void sendSessionUpdate(UUID sessionId, Map<String, Object> update) {
        messagingTemplate.convertAndSend("/topic/proctor/session/" + sessionId, update);
        log.debug("Session update pushed to proctor channel for session {}", sessionId);
    }
}
