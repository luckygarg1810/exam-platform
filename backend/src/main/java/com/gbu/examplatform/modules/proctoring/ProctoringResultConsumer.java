package com.gbu.examplatform.modules.proctoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.modules.session.ExamSessionService;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProctoringResultConsumer {

    private final ProctoringEventRepository proctoringEventRepository;
    private final ViolationSummaryRepository violationSummaryRepository;
    private final ExamSessionRepository sessionRepository;
    private final ExamSessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    // Auto-suspend threshold
    private static final int CRITICAL_THRESHOLD = 3;
    private static final double RISK_WEIGHT_CRITICAL = 10.0;
    private static final double RISK_WEIGHT_HIGH = 5.0;
    private static final double RISK_WEIGHT_MEDIUM = 2.0;
    private static final double RISK_WEIGHT_LOW = 0.5;

    @RabbitListener(queues = "proctoring.results")
    @Transactional
    public void handleProctoringResult(ProctoringResultMessage message) {
        log.debug("Received proctoring result for session: {}", message.getSessionId());

        try {
            UUID sessionId = UUID.fromString(message.getSessionId());
            Optional<ExamSession> sessionOpt = sessionRepository.findById(sessionId);

            if (sessionOpt.isEmpty()) {
                log.warn("No session found for proctoring result: {}", sessionId);
                return;
            }

            ExamSession session = sessionOpt.get();
            if (session.getSubmittedAt() != null || Boolean.TRUE.equals(session.getIsSuspended())) {
                return; // Session already closed
            }

            // Persist the proctoring event
            ProctoringEvent event = ProctoringEvent.builder()
                    .sessionId(sessionId)
                    .eventType(ProctoringEvent.EventType.valueOf(message.getEventType()))
                    .severity(ProctoringEvent.Severity.valueOf(message.getSeverity()))
                    .confidence(message.getConfidence())
                    .description(message.getDescription())
                    .snapshotPath(message.getSnapshotPath())
                    .metadata(message.getMetadata())
                    .source(ProctoringEvent.EventSource.AI)
                    .build();
            event = proctoringEventRepository.save(event);

            // Update violation summary
            ViolationSummary summary = violationSummaryRepository.findBySessionId(sessionId)
                    .orElseGet(() -> {
                        ViolationSummary s = ViolationSummary.builder().session(session).build();
                        return violationSummaryRepository.save(s);
                    });

            updateSummary(summary, event);
            violationSummaryRepository.save(summary);

            // Push real-time alert to proctors
            Map<String, Object> alert = new HashMap<>();
            alert.put("sessionId", sessionId);
            alert.put("eventType", event.getEventType());
            alert.put("severity", event.getSeverity());
            alert.put("confidence", event.getConfidence());
            alert.put("description", event.getDescription());
            alert.put("timestamp", Instant.now());
            messagingTemplate.convertAndSend("/topic/proctor/alerts", alert);

            // Also notify the student's own WebSocket
            messagingTemplate.convertAndSendToUser(
                    session.getEnrollment().getUser().getId().toString(),
                    "/queue/warnings",
                    Map.of("severity", event.getSeverity(), "message", event.getDescription()));

            // Auto-suspend if too many critical violations
            if (summary.getCriticalCount() >= CRITICAL_THRESHOLD) {
                log.warn("Auto-suspending session {} due to {} critical violations", sessionId,
                        summary.getCriticalCount());
                sessionService.suspendSession(sessionId, "Exceeded critical violation threshold");
                messagingTemplate.convertAndSend("/topic/proctor/suspensions",
                        Map.of("sessionId", sessionId, "reason", "Auto-suspended: too many critical violations"));
            }

        } catch (Exception e) {
            log.error("Error processing proctoring result: {}", e.getMessage(), e);
        }
    }

    private void updateSummary(ViolationSummary summary, ProctoringEvent event) {
        summary.setTotalViolations(summary.getTotalViolations() + 1);

        switch (event.getSeverity()) {
            case CRITICAL -> {
                summary.setCriticalCount(summary.getCriticalCount() + 1);
                summary.setRiskScore(summary.getRiskScore() + RISK_WEIGHT_CRITICAL);
            }
            case HIGH -> {
                summary.setHighCount(summary.getHighCount() + 1);
                summary.setRiskScore(summary.getRiskScore() + RISK_WEIGHT_HIGH);
            }
            case MEDIUM -> {
                summary.setMediumCount(summary.getMediumCount() + 1);
                summary.setRiskScore(summary.getRiskScore() + RISK_WEIGHT_MEDIUM);
            }
            case LOW -> {
                summary.setLowCount(summary.getLowCount() + 1);
                summary.setRiskScore(summary.getRiskScore() + RISK_WEIGHT_LOW);
            }
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProctoringResultMessage {
        private String sessionId;
        private String eventType;
        private String severity;
        private Double confidence;
        private String description;
        private String snapshotPath;
        private Map<String, Object> metadata;
    }
}
