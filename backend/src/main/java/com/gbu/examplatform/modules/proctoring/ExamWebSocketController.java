package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.config.RabbitMQConfig;
import com.gbu.examplatform.modules.notification.NotificationService;
import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.modules.session.ExamSessionService;
import com.gbu.examplatform.security.AuthenticatedUser;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * STOMP WebSocket handler for proctoring media.
 *
 * All @MessageMapping paths are relative to the application destination prefix
 * set in WebSocketConfig (/app).
 *
 * Student sends to:
 *   /app/exam/{sessionId}/frame     → decode Base64, relay to RabbitMQ frame.analysis
 *   /app/exam/{sessionId}/audio     → decode Base64, relay to RabbitMQ audio.analysis
 *   /app/exam/{sessionId}/event     → save behavior event to DB, relay to RabbitMQ behavior.events
 *   /app/exam/{sessionId}/heartbeat → update session heartbeat
 *
 * NOTE: @MessageMapping handlers run in the clientInboundChannel thread pool which
 * does NOT inherit Spring Security's SecurityContextHolder. Authentication is read
 * from the STOMP session Principal injected by Spring, which is set by
 * WebSocketChannelInterceptor during the CONNECT frame.
 */
@Controller
@Slf4j
@RequiredArgsConstructor
public class ExamWebSocketController {

    private final RabbitTemplate rabbitTemplate;
    private final ExamSessionRepository sessionRepository;
    private final ExamSessionService sessionService;
    private final BehaviorEventRepository behaviorEventRepository;
    private final ProctoringEventRepository proctoringEventRepository;
    private final ViolationSummaryRepository violationSummaryRepository;
    private final NotificationService notificationService;
    private final StringRedisTemplate stringRedisTemplate;

    // Tab-switch threshold before alert is escalated to HIGH severity
    private static final int TAB_SWITCH_WARN_THRESHOLD = 3;

    // Rate limits per session per second for each handler type
    private static final int RATE_FRAME = 2;
    private static final int RATE_AUDIO = 1;
    private static final int RATE_EVENT = 10;
    private static final int RATE_HEARTBEAT = 1;

    /**
     * Receives a Base64-encoded JPEG frame from the student's webcam.
     * Validates session, publishes to RabbitMQ for async AI analysis.
     */
    @MessageMapping("/exam/{sessionId}/frame")
    public void handleFrame(@DestinationVariable UUID sessionId,
            @Payload Map<String, Object> payload,
            Principal principal) {
        if (isRateLimited(sessionId, "frame", RATE_FRAME)) {
            log.debug("Rate limit exceeded for frame on session {}", sessionId);
            return;
        }
        ExamSession session = validateSession(sessionId, principal);
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
            @Payload Map<String, Object> payload,
            Principal principal) {
        if (isRateLimited(sessionId, "audio", RATE_AUDIO)) {
            log.debug("Rate limit exceeded for audio on session {}", sessionId);
            return;
        }
        ExamSession session = validateSession(sessionId, principal);
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
     * Receives a browser behavior event (tab switch, fullscreen exit, copy, paste, etc.).
     * Saves immediately to DB, applies quick rule-based checks, relays to RabbitMQ.
     */
    @MessageMapping("/exam/{sessionId}/event")
    @Transactional
    public void handleBehaviorEvent(@DestinationVariable UUID sessionId,
            @Payload Map<String, Object> payload,
            Principal principal) {
        if (isRateLimited(sessionId, "event", RATE_EVENT)) {
            log.debug("Rate limit exceeded for event on session {}", sessionId);
            return;
        }
        ExamSession session = validateSession(sessionId, principal);
        if (session == null)
            return;

        String eventType = String.valueOf(payload.getOrDefault("type", "UNKNOWN"));
        // Normalize browser copy/paste event names to the canonical enum name so the
        // ViolationSummary counter is incremented correctly (Issue 35).
        if ("COPY_ATTEMPT".equalsIgnoreCase(eventType) || "PASTE_ATTEMPT".equalsIgnoreCase(eventType)) {
            eventType = "COPY_PASTE";
        }
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

        // Save a ProctoringEvent, update ViolationSummary counters, and
        // broadcast to the teacher's live alert feed so violations appear
        // immediately on the dashboard without waiting for the AI service.
        applyQuickRules(session, sessionId, eventType);

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
     * Session keep-alive: updates last_heartbeat_at in DB and refreshes Redis presence TTL.
     * Client should send every 30 seconds.
     */
    @MessageMapping("/exam/{sessionId}/heartbeat")
    public void handleHeartbeat(@DestinationVariable UUID sessionId, Principal principal) {
        if (isRateLimited(sessionId, "heartbeat", RATE_HEARTBEAT)) {
            log.debug("Rate limit exceeded for heartbeat on session {}", sessionId);
            return;
        }
        if (validateSession(sessionId, principal) == null)
            return;
        sessionService.heartbeatFromWs(sessionId);
        log.debug("Heartbeat received for session {}", sessionId);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Extracts the AuthenticatedUser from the STOMP session Principal.
     * The Principal is a UsernamePasswordAuthenticationToken set by
     * WebSocketChannelInterceptor during the CONNECT frame.
     * Returns null if the principal is missing or malformed.
     */
    private AuthenticatedUser extractUser(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth
                && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        log.warn("WebSocket handler: cannot extract AuthenticatedUser from principal {}", principal);
        return null;
    }

    /**
     * Validates that a session exists, is not submitted, and is not suspended.
     * Also enforces that students can only interact with their own session.
     * TEACHER and ADMIN principals may interact with any session.
     *
     * Uses the STOMP session Principal directly — does NOT touch SecurityContextHolder,
     * which is not populated in clientInboundChannel threads.
     */
    private ExamSession validateSession(UUID sessionId, Principal principal) {
        ExamSession session = sessionRepository.findById(sessionId)
                .filter(s -> s.getSubmittedAt() == null && !Boolean.TRUE.equals(s.getIsSuspended()))
                .orElseGet(() -> {
                    log.warn("WebSocket message dropped: session {} is closed or suspended", sessionId);
                    return null;
                });
        if (session == null)
            return null;

        AuthenticatedUser user = extractUser(principal);
        if (user == null) {
            log.warn("WebSocket message dropped: unauthenticated principal for session {}", sessionId);
            return null;
        }

        // Proctors / teachers / admins may observe any session
        String role = user.getRole();
        if ("ADMIN".equals(role) || "TEACHER".equals(role) || "PROCTOR".equals(role)) {
            return session;
        }

        // Students must own the session
        if ("STUDENT".equals(role)) {
            UUID userId = UUID.fromString(user.getId());
            if (sessionRepository.countByIdAndUserId(sessionId, userId) == 0) {
                log.warn("WebSocket message dropped: user {} does not own session {}", userId, sessionId);
                return null;
            }
            return session;
        }

        log.warn("WebSocket message dropped: unrecognised role {} for session {}", role, sessionId);
        return null;
    }

    /**
     * Sliding-window rate limiter using Redis INCR + EXPIRE.
     * Returns true if the request should be dropped (limit exceeded).
     */
    private boolean isRateLimited(UUID sessionId, String handler, int limitPerSecond) {
        String key = "ws:rl:" + sessionId + ":" + handler;
        Long count = stringRedisTemplate.opsForValue().increment(key);
        if (count != null && count == 1) {
            // First call in this window — set a 1-second TTL
            stringRedisTemplate.expire(key, Duration.ofSeconds(1));
        }
        return count != null && count > limitPerSecond;
    }

    /**
     * Applies rule-based violation logic for browser behavior events.
     *
     * For every recognized browser event this now:
     *   1. Saves a {@link ProctoringEvent} (source=BROWSER) so it appears in the
     *      teacher's violation event list on the session detail page.
     *   2. Increments the matching {@link ViolationSummary} counter so the summary
     *      chips update without waiting for the AI service.
     *   3. Broadcasts a real-time alert to the teacher's live feed via
     *      {@link NotificationService#broadcastExamAlert} so the InvigilateExam
     *      dashboard shows the violation instantly.
     *
     * Tab switches below TAB_SWITCH_WARN_THRESHOLD are still recorded but sent
     * at MEDIUM severity to avoid spamming the teacher on minor accidental blurs.
     */
    private void applyQuickRules(ExamSession session, UUID sessionId, String eventType) {
        ProctoringEvent.EventType peType;
        ProctoringEvent.Severity severity;
        String description;

        switch (eventType.toUpperCase()) {
            case "TAB_SWITCH", "FOCUS_LOST" -> {
                long tabSwitchCount = behaviorEventRepository
                        .countBySessionIdAndEventType(sessionId, "TAB_SWITCH")
                        + behaviorEventRepository.countBySessionIdAndEventType(sessionId, "FOCUS_LOST");

                peType = ProctoringEvent.EventType.TAB_SWITCH;
                severity = tabSwitchCount >= TAB_SWITCH_WARN_THRESHOLD
                        ? ProctoringEvent.Severity.HIGH
                        : ProctoringEvent.Severity.MEDIUM;
                description = "Tab switch detected (total: " + tabSwitchCount + ")";
            }
            case "FULLSCREEN_EXIT" -> {
                peType = ProctoringEvent.EventType.FULLSCREEN_EXIT;
                severity = ProctoringEvent.Severity.MEDIUM;
                description = "Student exited fullscreen mode";
            }
            case "COPY_PASTE" -> {
                peType = ProctoringEvent.EventType.COPY_PASTE;
                severity = ProctoringEvent.Severity.HIGH;
                description = "Copy/paste attempt detected";
            }
            default -> {
                // Unknown browser event — no structured rule; logged by caller
                log.debug("No quick rule for browser event '{}' on session {}", eventType, sessionId);
                return;
            }
        }

        // 1. Persist ProctoringEvent (visible in teacher's session detail list)
        saveProctoringEvent(sessionId, peType, severity, description);

        // 2. Increment ViolationSummary counter (visible in summary chips)
        updateViolationSummaryCounter(session, sessionId, peType);

        // 3. Broadcast to teacher's live alert feed on the InvigilateExam page
        UUID examId = session.getEnrollment().getExam().getId();
        notificationService.broadcastExamAlert(
                examId, sessionId, peType.name(), severity.name(), 1.0, description);

        log.debug("Quick-rule violation broadcast — session={} type={} severity={}",
                sessionId, peType.name(), severity.name());
    }

    private void saveProctoringEvent(UUID sessionId, ProctoringEvent.EventType type,
            ProctoringEvent.Severity severity, String description) {
        ProctoringEvent pe = ProctoringEvent.builder()
                .sessionId(sessionId)
                .eventType(type)
                .severity(severity)
                .confidence(1.0)
                .description(description)
                .source(ProctoringEvent.EventSource.BROWSER)
                .build();
        proctoringEventRepository.save(pe);
    }

    private void updateViolationSummaryCounter(ExamSession session, UUID sessionId,
            ProctoringEvent.EventType type) {
        ViolationSummary summary = violationSummaryRepository.findBySession_Id(sessionId)
                .orElseGet(() -> ViolationSummary.builder().session(session).build());
        switch (type) {
            case TAB_SWITCH -> summary.setTabSwitchCount(summary.getTabSwitchCount() + 1);
            case FULLSCREEN_EXIT -> summary.setFullscreenExitCount(summary.getFullscreenExitCount() + 1);
            case COPY_PASTE -> summary.setCopyPasteCount(summary.getCopyPasteCount() + 1);
            default -> { /* no counter mapping */ }
        }
        violationSummaryRepository.save(summary);
    }
}
