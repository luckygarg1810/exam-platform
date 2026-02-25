package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.modules.notification.NotificationService;
import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.modules.session.ExamSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Consumes AI analysis results from the proctoring.results queue.
 *
 * Accepts raw Map<String, Object> so Jackson doesn't need __TypeId__ headers —
 * important because Python does not set Spring's type hints.
 *
 * Expected JSON structure from Python AI service:
 * {
 * "sessionId": "...",
 * "eventType": "PHONE_DETECTED", // matches ProctoringEvent.EventType names
 * "severity": "HIGH", // LOW | MEDIUM | HIGH | CRITICAL
 * "confidence": 0.87,
 * "description": "...",
 * "snapshotPath": "...", // MinIO path, nullable
 * "riskScore": 0.72, // normalized 0.0 – 1.0
 * "metadata": {}
 * }
 *
 * HIGH_RISK (>0.75) → push alert to proctors
 * CRITICAL (>0.90) → auto-suspend session + notify student
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProctoringResultConsumer {

    private static final double HIGH_RISK_THRESHOLD = 0.75;
    private static final double CRITICAL_THRESHOLD = 0.90;

    /**
     * Rolling time window for suspension decisions.
     * We track every frame that arrives in the last WINDOW_SECONDS seconds.
     * If at least MIN_FRAMES_IN_WINDOW frames have been received AND the
     * fraction that are CRITICAL exceeds CRITICAL_RATIO_THRESHOLD, the session
     * is auto-suspended.
     *
     * This is more robust than a consecutive-streak counter because dropped or
     * delayed frames (network jitter) no longer reset the decision — a student
     * who is consistently cheating will accumulate CRITICAL frames in the window
     * even if a few frames are lost or arrive late.
     */
    private static final long WINDOW_SECONDS = 30L; // rolling window width
    private static final long WINDOW_TTL_SECONDS = 90L; // Redis key TTL (3× window)
    private static final int MIN_FRAMES_IN_WINDOW = 5; // cold-start guard
    private static final double CRITICAL_RATIO_THRESHOLD = 0.70; // 70 % of frames must be CRITICAL

    private static final String RISK_FRAMES_KEY_PREFIX = "session:risk:frames:";
    private static final String RISK_CRITICAL_KEY_PREFIX = "session:risk:critical:";

    private final ProctoringEventRepository proctoringEventRepository;
    private final ViolationSummaryRepository violationSummaryRepository;
    private final ExamSessionRepository sessionRepository;
    private final ExamSessionService sessionService;
    private final NotificationService notificationService;
    private final RedisTemplate<String, String> redisTemplate;

    @RabbitListener(queues = "#{T(com.gbu.examplatform.config.RabbitMQConfig).PROCTORING_RESULTS_QUEUE}")
    @Transactional
    public void handleProctoringResult(@Payload Map<String, Object> payload) {
        String sessionIdStr = getString(payload, "sessionId");
        if (sessionIdStr == null) {
            log.warn("Proctoring result missing sessionId, skipping");
            return;
        }

        UUID sessionId;
        try {
            sessionId = UUID.fromString(sessionIdStr);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid sessionId in proctoring result: {}", sessionIdStr);
            return;
        }

        Optional<ExamSession> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            log.warn("Session not found for proctoring result: {}", sessionId);
            return;
        }

        ExamSession session = sessionOpt.get();
        // Ignore results for already-closed sessions
        if (session.getSubmittedAt() != null || Boolean.TRUE.equals(session.getIsSuspended())) {
            log.debug("Ignoring result for closed/suspended session {}", sessionId);
            return;
        }

        // ----------------------------------------------------------------
        // 1. Persist proctoring event
        // ----------------------------------------------------------------
        String eventTypeStr = getString(payload, "eventType");
        String severityStr = getString(payload, "severity");
        Double confidence = getDouble(payload, "confidence");
        String description = getString(payload, "description");
        String snapshotPath = getString(payload, "snapshotPath");
        Double riskScore = getDouble(payload, "riskScore");

        ProctoringEvent.EventType eventType = parseEnum(ProctoringEvent.EventType.class,
                eventTypeStr, ProctoringEvent.EventType.MANUAL_FLAG);
        ProctoringEvent.Severity severity = parseEnum(ProctoringEvent.Severity.class,
                severityStr, ProctoringEvent.Severity.MEDIUM);

        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = payload.containsKey("metadata")
                ? (Map<String, Object>) payload.get("metadata")
                : null;

        ProctoringEvent event = ProctoringEvent.builder()
                .sessionId(sessionId)
                .eventType(eventType)
                .severity(severity)
                .confidence(confidence)
                .description(description)
                .snapshotPath(snapshotPath)
                .metadata(metadata)
                .source(ProctoringEvent.EventSource.AI)
                .build();
        proctoringEventRepository.save(event);

        // ----------------------------------------------------------------
        // 2. Update violation summary counters
        // ----------------------------------------------------------------
        ViolationSummary summary = violationSummaryRepository.findBySession_Id(sessionId)
                .orElseGet(() -> {
                    ViolationSummary s = ViolationSummary.builder().session(session).build();
                    return violationSummaryRepository.save(s);
                });

        updateCounters(summary, eventType);
        if (riskScore != null) {
            // Use the AI's computed risk score (max of current and new, so it only goes
            // up).
            // Clamp to 1.0 to guard against malformed AI output (Issue 34).
            double clamped = Math.min(1.0, riskScore);
            summary.setRiskScore(Math.max(summary.getRiskScore(), clamped));
        }
        violationSummaryRepository.save(summary);

        // ----------------------------------------------------------------
        // 3. Push real-time alert to proctors for all events
        // ----------------------------------------------------------------
        notificationService.broadcastProctorAlert(sessionId, eventType.name(), severity.name(),
                confidence, description);

        // ----------------------------------------------------------------
        // 4. Warn student for HIGH violations
        // ----------------------------------------------------------------
        if (severity == ProctoringEvent.Severity.HIGH || severity == ProctoringEvent.Severity.CRITICAL) {
            String warningMsg = buildWarningMessage(eventType);
            notificationService.sendWarning(sessionId, warningMsg);
        }

        // ----------------------------------------------------------------
        // 5. Time-window-based auto-suspend on CRITICAL risk score (> 90%)
        //
        // Instead of counting only *consecutive* critical frames (which resets
        // on every clean/dropped frame), we maintain two Redis ZSETs:
        // session:risk:frames:<id> — one member per frame, scored by epoch-ms
        // session:risk:critical:<id> — same but only for CRITICAL frames
        //
        // On each frame we:
        // 1. Add the frame to both ZSETs as appropriate.
        // 2. Prune members older than WINDOW_SECONDS.
        // 3. If total frames ≥ MIN_FRAMES_IN_WINDOW AND
        // critical / total ≥ CRITICAL_RATIO_THRESHOLD → suspend.
        //
        // Network jitter (dropped/delayed frames) no longer prevents suspension
        // because we measure a ratio over time, not a strict consecutive count.
        // ----------------------------------------------------------------
        long nowMs = System.currentTimeMillis();
        double windowStartMs = (double) (nowMs - WINDOW_SECONDS * 1000L);
        String frameMember = UUID.randomUUID().toString(); // unique per frame
        String framesKey = RISK_FRAMES_KEY_PREFIX + sessionId;
        String criticalKey = RISK_CRITICAL_KEY_PREFIX + sessionId;

        // Record this frame in the all-frames ZSET
        redisTemplate.opsForZSet().add(framesKey, frameMember, (double) nowMs);

        // Record in the critical ZSET only if this frame is truly CRITICAL
        if (riskScore != null && riskScore > CRITICAL_THRESHOLD) {
            redisTemplate.opsForZSet().add(criticalKey, frameMember, (double) nowMs);
        }

        // Prune entries that have aged out of the rolling window
        redisTemplate.opsForZSet().removeRangeByScore(framesKey, Double.NEGATIVE_INFINITY, windowStartMs);
        redisTemplate.opsForZSet().removeRangeByScore(criticalKey, Double.NEGATIVE_INFINITY, windowStartMs);

        // Refresh TTL so idle-session keys don't linger indefinitely
        redisTemplate.expire(framesKey, WINDOW_TTL_SECONDS, TimeUnit.SECONDS);
        redisTemplate.expire(criticalKey, WINDOW_TTL_SECONDS, TimeUnit.SECONDS);

        // Evaluate suspension threshold
        Long totalFrames = redisTemplate.opsForZSet().zCard(framesKey);
        Long criticalFrames = redisTemplate.opsForZSet().zCard(criticalKey);

        if (totalFrames != null && criticalFrames != null
                && totalFrames >= MIN_FRAMES_IN_WINDOW
                && (double) criticalFrames / totalFrames >= CRITICAL_RATIO_THRESHOLD) {

            // Clean up Redis before suspending so a re-queued message cannot
            // trigger a second suspension for the same session
            redisTemplate.delete(framesKey);
            redisTemplate.delete(criticalKey);

            int pct = (int) Math.round((double) criticalFrames / totalFrames * 100);
            log.warn("Auto-suspending session {} — {}/{} CRITICAL frames in last {}s ({}%)",
                    sessionId, criticalFrames, totalFrames, WINDOW_SECONDS, pct);
            try {
                sessionService.suspendSession(sessionId,
                        String.format("Auto-suspended: %d/%d critical AI frames in last %ds (%d%%)",
                                criticalFrames, totalFrames, WINDOW_SECONDS, pct));
            } catch (Exception e) {
                log.error("Failed to auto-suspend session {}: {}", sessionId, e.getMessage());
            }
        } else {
            log.debug("Session {} window: {}/{} critical frames in last {}s",
                    sessionId,
                    criticalFrames != null ? criticalFrames : 0,
                    totalFrames != null ? totalFrames : 0,
                    WINDOW_SECONDS);
        }
    }

    // -----------------------------------------------------------------------
    // Counter update (event-type → summary field mapping)
    // -----------------------------------------------------------------------
    private void updateCounters(ViolationSummary summary, ProctoringEvent.EventType eventType) {
        switch (eventType) {
            case FACE_MISSING ->
                summary.setFaceAwayCount(summary.getFaceAwayCount() + 1);
            case GAZE_AWAY ->
                summary.setGazeAwayCount(summary.getGazeAwayCount() + 1);
            case MOUTH_OPEN ->
                summary.setMouthOpenCount(summary.getMouthOpenCount() + 1);
            case MULTIPLE_FACES ->
                summary.setMultipleFaceCount(summary.getMultipleFaceCount() + 1);
            case MULTIPLE_PERSONS ->
                summary.setMultiplePersonsCount(summary.getMultiplePersonsCount() + 1);
            case PHONE_DETECTED ->
                summary.setPhoneDetectedCount(summary.getPhoneDetectedCount() + 1);
            case AUDIO_SPEECH ->
                summary.setAudioViolationCount(summary.getAudioViolationCount() + 1);
            case TAB_SWITCH ->
                summary.setTabSwitchCount(summary.getTabSwitchCount() + 1);
            case FULLSCREEN_EXIT ->
                summary.setFullscreenExitCount(summary.getFullscreenExitCount() + 1);
            case COPY_PASTE ->
                summary.setCopyPasteCount(summary.getCopyPasteCount() + 1);
            // Previously fell through to default and were silently ignored (Issue 25)
            case NOTES_DETECTED ->
                summary.setNotesDetectedCount(summary.getNotesDetectedCount() + 1);
            case IDENTITY_MISMATCH ->
                summary.setIdentityMismatchCount(summary.getIdentityMismatchCount() + 1);
            case MANUAL_FLAG ->
                summary.setManualFlagCount(summary.getManualFlagCount() + 1);
            case SUSPICIOUS_BEHAVIOR ->
                summary.setSuspiciousBehaviorCount(summary.getSuspiciousBehaviorCount() + 1);
            default -> {
                /* no counter for unrecognised types */ }
        }
    }

    private String buildWarningMessage(ProctoringEvent.EventType eventType) {
        return switch (eventType) {
            case FACE_MISSING -> "Warning: Your face is not visible. Please face the camera.";
            case MULTIPLE_FACES -> "Warning: Multiple faces detected. Only you should be visible.";
            case MULTIPLE_PERSONS ->
                "Warning: An extra person was detected in your environment. Please ensure you are alone.";
            case GAZE_AWAY -> "Warning: Please keep your eyes on the screen.";
            case PHONE_DETECTED -> "Warning: A mobile phone was detected. Remove it from view.";
            case AUDIO_SPEECH -> "Warning: Speech detected. Exams must be taken in silence.";
            case SUSPICIOUS_BEHAVIOR -> "Warning: Suspicious activity pattern detected. Avoid irregular behaviour.";
            case TAB_SWITCH -> "Warning: Tab switching detected. Stay on the exam page.";
            case FULLSCREEN_EXIT -> "Warning: Fullscreen mode was exited. Please return to fullscreen.";
            default -> "Warning: A violation has been recorded for this session.";
        };
    }

    // -----------------------------------------------------------------------
    // Deserialization helpers (Python sends plain JSON without type headers)
    // -----------------------------------------------------------------------
    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private Double getDouble(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null)
            return null;
        if (val instanceof Number n)
            return n.doubleValue();
        try {
            return Double.parseDouble(val.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private <E extends Enum<E>> E parseEnum(Class<E> cls, String value, E fallback) {
        if (value == null)
            return fallback;
        try {
            return Enum.valueOf(cls, value.toUpperCase());
        } catch (Exception e) {
            return fallback;
        }
    }
}
