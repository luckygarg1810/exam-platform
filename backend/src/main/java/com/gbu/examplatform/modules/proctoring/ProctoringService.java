package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProctoringService {
    private static final Logger log = LoggerFactory.getLogger(ProctoringService.class);

    private final ProctoringEventRepository eventRepository;
    private final ViolationSummaryRepository summaryRepository;
    private final ExamSessionRepository sessionRepository;

    @Transactional(readOnly = true)
    public Page<ProctoringEvent> getSessionEvents(UUID sessionId, Pageable pageable) {
        return eventRepository.findBySessionId(sessionId, pageable);
    }

    @Transactional(readOnly = true)
    public ViolationSummary getSessionSummary(UUID sessionId) {
        return summaryRepository.findBySession_Id(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Violation summary", sessionId.toString()));
    }

    @Transactional
    public ProctoringEvent addManualFlag(UUID sessionId, String eventTypeStr, String description) {
        ExamSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId.toString()));

        ProctoringEvent.EventType eventType;
        try {
            eventType = ProctoringEvent.EventType.valueOf(eventTypeStr);
        } catch (Exception e) {
            eventType = ProctoringEvent.EventType.MANUAL_FLAG;
        }

        ProctoringEvent event = ProctoringEvent.builder()
                .sessionId(sessionId)
                .eventType(eventType)
                .severity(ProctoringEvent.Severity.HIGH)
                .confidence(1.0)
                .description(description)
                .source(ProctoringEvent.EventSource.MANUAL)
                .build();
        event = eventRepository.save(event);

        // Upsert violation summary — set proctorFlag = true
        ViolationSummary summary = summaryRepository.findBySession_Id(sessionId)
                .orElseGet(() -> ViolationSummary.builder().session(session).build());
        summary.setProctorFlag(true);
        summaryRepository.save(summary);

        return event;
    }

    @Transactional
    public void clearProctorFlag(UUID sessionId) {
        ViolationSummary summary = summaryRepository.findBySession_Id(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Violation summary", sessionId.toString()));
        summary.setProctorFlag(false);
        summaryRepository.save(summary);
        log.info("Proctor flag cleared for session {}", sessionId);
    }

    @Transactional
    public void addProctorNote(UUID sessionId, String note) {
        ViolationSummary summary = summaryRepository.findBySession_Id(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Violation summary", sessionId.toString()));
        summary.setProctorNote(note);
        summaryRepository.save(summary);
    }
}
