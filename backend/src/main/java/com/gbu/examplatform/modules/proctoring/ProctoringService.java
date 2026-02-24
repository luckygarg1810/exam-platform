package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.session.ExamSessionService;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProctoringService {
    private static final Logger log = LoggerFactory.getLogger(ProctoringService.class);

    private final ProctoringEventRepository eventRepository;
    private final ViolationSummaryRepository summaryRepository;
    private final ExamSessionService sessionService;

    @Transactional(readOnly = true)
    public Page<ProctoringEvent> getSessionEvents(UUID sessionId, Pageable pageable) {
        return eventRepository.findBySessionId(sessionId, pageable);
    }

    @Transactional(readOnly = true)
    public ViolationSummary getSessionSummary(UUID sessionId) {
        return summaryRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Violation summary", sessionId.toString()));
    }

    @Transactional
    public ProctoringEvent addManualFlag(UUID sessionId, String eventType, String description) {
        // Verify session exists
        sessionService.getSession(sessionId);

        ProctoringEvent event = ProctoringEvent.builder()
                .sessionId(sessionId)
                .eventType(ProctoringEvent.EventType.MANUAL_FLAG)
                .severity(ProctoringEvent.Severity.HIGH)
                .confidence(1.0)
                .description(description)
                .source(ProctoringEvent.EventSource.MANUAL)
                .build();

        event = eventRepository.save(event);

        // Update summary
        ViolationSummary summary = summaryRepository.findBySessionId(sessionId)
                .orElseGet(() -> ViolationSummary.builder().build());
        summary.setProctorFlagged(true);
        summary.setHighCount(summary.getHighCount() + 1);
        summary.setTotalViolations(summary.getTotalViolations() + 1);
        summary.setRiskScore(summary.getRiskScore() + 5.0);
        summaryRepository.save(summary);

        return event;
    }

    @Transactional
    public void addProctorNotes(UUID sessionId, String notes) {
        ViolationSummary summary = summaryRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Violation summary", sessionId.toString()));
        summary.setProctorNotes(notes);
        summaryRepository.save(summary);
    }
}
