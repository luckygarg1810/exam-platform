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
 * /queue/exam/{sessionId}/warning → warning shown as amber banner to student
 * /queue/exam/{sessionId}/suspend → red suspension overlay, locks exam UI
 * /topic/proctor/alerts → broadcast violation alert to all proctors
 * /topic/proctor/session/{id} → per-session live updates to proctor
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
     * Broadcasts a violation alert to all connected proctors.
     * Proctors subscribe to: /topic/proctor/alerts
     */
    public void broadcastProctorAlert(UUID sessionId, String eventType, String severity,
            Double confidence, String description) {
        Map<String, Object> payload = Map.of(
                "sessionId", sessionId.toString(),
                "eventType", eventType,
                "severity", severity,
                "confidence", confidence != null ? confidence : 0.0,
                "description", description != null ? description : "",
                "timestamp", Instant.now().toString());
        messagingTemplate.convertAndSend("/topic/proctor/alerts", payload);
        log.debug("Proctor alert broadcast for session {}: {} [{}]", sessionId, eventType, severity);
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
