package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.config.RabbitMQConfig;
import com.gbu.examplatform.modules.notification.NotificationService;
import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.modules.session.ExamSessionService;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * STOMP WebSocket handler for proctoring media.
 *
 * All @MessageMapping paths are relative to the application destination prefix
 * set in WebSocketConfig (/app).
 *
 * Student sends to:
 * /app/exam/{sessionId}/frame → decode Base64, relay to RabbitMQ frame.analysis
 * /app/exam/{sessionId}/audio → decode Base64, relay to RabbitMQ audio.analysis
 * /app/exam/{sessionId}/event → save behavior event to DB, relay to RabbitMQ
 * behavior.events
 * /app/exam/{sessionId}/heartbeat → update session heartbeat
 */
@Controller
@Slf4j
@RequiredArgsConstructor
public class ExamWebSocketController {

    private final RabbitTemplate rabbitTemplate;
    private final ExamSessionRepository sessionRepository;
    private final ExamSessionService sessionService;
    private final BehaviorEventRepository behaviorEventRepository;
    private final NotificationService notificationService;
    private final RedisTemplate<String, String> redisTemplate;

    // Tab-switch threshold for immediate warning
    private static final int TAB_SWITCH_WARN_THRESHOLD = 3;

    /**
     * Receives a Base64-encoded JPEG frame from the student's webcam.
     * Validates session, publishes to RabbitMQ for async AI analysis.
     */
    @MessageMapping("/exam/{sessionId}/frame")
    public void handleFrame(@DestinationVariable UUID sessionId,
            @Payload Map<String, Object> payload) {
        ExamSession session = validateSession(sessionId);
        if (session == null)
            return;

        Map<String, Object> message = new HashMap<>(payload);
        message.put("sessionId", sessionId.toString());
        message.put("timestamp", Instant.now().toEpochMilli());

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.PROCTORING_EXCHANGE,
                RabbitMQConfig.FRAME_ROUTING_KEY,
                message);

        log.debug("Relayed frame to RabbitMQ for session {}", sessionId);
    }

    /**
     * Receives a Base64-encoded audio blob (10s WebM chunk) from the student.
     * Validates session, publishes to RabbitMQ for async voice-activity detection.
     */
    @MessageMapping("/exam/{sessionId}/audio")
    public void handleAudio(@DestinationVariable UUID sessionId,
            @Payload Map<String, Object> payload) {
        ExamSession session = validateSession(sessionId);
        if (session == null)
            return;

        Map<String, Object> message = new HashMap<>(payload);
        message.put("sessionId", sessionId.toString());
        message.put("timestamp", Instant.now().toEpochMilli());

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.PROCTORING_EXCHANGE,
                RabbitMQConfig.AUDIO_ROUTING_KEY,
                message);

        log.debug("Relayed audio to RabbitMQ for session {}", sessionId);
    }

    /**
     * Receives a browser behavior event (tab switch, fullscreen exit, copy, paste,
     * etc.).
     * Saves immediately to DB, applies quick rule-based checks, relays to RabbitMQ.
     */
    @MessageMapping("/exam/{sessionId}/event")
    @Transactional
    public void handleBehaviorEvent(@DestinationVariable UUID sessionId,
            @Payload Map<String, Object> payload) {
        ExamSession session = validateSession(sessionId);
        if (session == null)
            return;

        String eventType = String.valueOf(payload.getOrDefault("type", "UNKNOWN"));
        Object tsObj = payload.getOrDefault("timestamp", System.currentTimeMillis());
        long tsMillis;
        if (tsObj instanceof Number) {
            tsMillis = ((Number) tsObj).longValue();
        } else {
            try {
                tsMillis = Long.parseLong(String.valueOf(tsObj));
            } catch (NumberFormatException e) {
                tsMillis = System.currentTimeMillis();
            }
        }
        Instant timestamp = Instant.ofEpochMilli(tsMillis);

        // Persist raw browser event
        BehaviorEvent be = BehaviorEvent.builder()
                .sessionId(sessionId)
                .eventType(eventType)
                .timestamp(timestamp)
                .metadata(payload)
                .build();
        behaviorEventRepository.save(be);

        // Quick rule-based check: warn after N tab switches without waiting for AI
        applyQuickRules(sessionId, eventType);

        // Relay to RabbitMQ for XGBoost behavior analysis
        Map<String, Object> message = new HashMap<>(payload);
        message.put("sessionId", sessionId.toString());
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.PROCTORING_EXCHANGE,
                RabbitMQConfig.BEHAVIOR_ROUTING_KEY,
                message);

        log.debug("Saved + relayed behavior event '{}' for session {}", eventType, sessionId);
    }

    /**
     * Session keep-alive: updates last_heartbeat_at in DB and refreshes Redis
     * presence TTL.
     * Client should send every 30 seconds.
     */
    @MessageMapping("/exam/{sessionId}/heartbeat")
    public void handleHeartbeat(@DestinationVariable UUID sessionId) {
        ExamSession session = validateSession(sessionId);
        if (session == null)
            return;

        session.setLastHeartbeatAt(Instant.now());
        sessionRepository.save(session);

        // Refresh Redis presence key — 30 min rolling TTL
        redisTemplate.opsForValue().set("session:active:" + sessionId, "1", 30, TimeUnit.MINUTES);
        log.debug("Heartbeat received for session {}", sessionId);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Validates that a session exists, is not submitted, and is not suspended.
     * Returns null and logs a warning if any check fails (WebSocket handlers can't
     * throw HTTP errors).
     */
    private ExamSession validateSession(UUID sessionId) {
        return sessionRepository.findById(sessionId)
                .filter(s -> s.getSubmittedAt() == null && !Boolean.TRUE.equals(s.getIsSuspended()))
                .orElseGet(() -> {
                    log.warn("WebSocket message dropped: session {} is closed or suspended", sessionId);
                    return null;
                });
    }

    /**
     * Applies quick rule-based warnings without waiting for AI.
     * Called synchronously so warnings are immediate.
     */
    private void applyQuickRules(UUID sessionId, String eventType) {
        if ("TAB_SWITCH".equalsIgnoreCase(eventType) || "FOCUS_LOST".equalsIgnoreCase(eventType)) {
            long tabSwitchCount = behaviorEventRepository
                    .countBySessionIdAndEventType(sessionId, "TAB_SWITCH")
                    + behaviorEventRepository.countBySessionIdAndEventType(sessionId, "FOCUS_LOST");

            if (tabSwitchCount >= TAB_SWITCH_WARN_THRESHOLD) {
                notificationService.sendWarning(sessionId,
                        "Warning: You have switched away from the exam " + tabSwitchCount
                                + " times. Continuing may result in disqualification.");
            }
        }

        if ("FULLSCREEN_EXIT".equalsIgnoreCase(eventType)) {
            notificationService.sendWarning(sessionId,
                    "Warning: You exited fullscreen mode. Please switch back immediately.");
        }

        if ("COPY_ATTEMPT".equalsIgnoreCase(eventType) || "PASTE_ATTEMPT".equalsIgnoreCase(eventType)) {
            notificationService.sendWarning(sessionId,
                    "Warning: Copy/paste detected. This action has been recorded.");
        }
    }
}
