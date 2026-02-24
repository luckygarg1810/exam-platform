package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.modules.notification.NotificationService;
import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.modules.session.ExamSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

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

    private final ProctoringEventRepository proctoringEventRepository;
    private final ViolationSummaryRepository violationSummaryRepository;
    private final ExamSessionRepository sessionRepository;
    private final ExamSessionService sessionService;
    private final NotificationService notificationService;

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
        // 5. Auto-suspend on CRITICAL risk score (> 90%)
        // ----------------------------------------------------------------
        if (riskScore != null && riskScore > CRITICAL_THRESHOLD) {
            log.warn("Auto-suspending session {} — risk score {}", sessionId, riskScore);
            try {
                sessionService.suspendSession(sessionId,
                        "Auto-suspended: AI risk score " + String.format("%.0f%%", riskScore * 100));
            } catch (Exception e) {
                log.error("Failed to auto-suspend session {}: {}", sessionId, e.getMessage());
            }
        }
    }

    // -----------------------------------------------------------------------
    // Counter update (event-type → summary field mapping)
    // -----------------------------------------------------------------------
    private void updateCounters(ViolationSummary summary, ProctoringEvent.EventType eventType) {
        switch (eventType) {
            case FACE_MISSING, GAZE_AWAY, MOUTH_OPEN ->
                summary.setFaceAwayCount(summary.getFaceAwayCount() + 1);
            case MULTIPLE_FACES ->
                summary.setMultipleFaceCount(summary.getMultipleFaceCount() + 1);
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
            default -> {
                /* no counter for unrecognised types */ }
        }
    }

    private String buildWarningMessage(ProctoringEvent.EventType eventType) {
        return switch (eventType) {
            case FACE_MISSING -> "Warning: Your face is not visible. Please face the camera.";
            case MULTIPLE_FACES -> "Warning: Multiple faces detected. Only you should be visible.";
            case GAZE_AWAY -> "Warning: Please keep your eyes on the screen.";
            case PHONE_DETECTED -> "Warning: A mobile phone was detected. Remove it from view.";
            case AUDIO_SPEECH -> "Warning: Speech detected. Exams must be taken in silence.";
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
