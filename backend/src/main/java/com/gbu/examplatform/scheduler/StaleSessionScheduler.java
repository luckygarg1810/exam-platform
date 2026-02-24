package com.gbu.examplatform.scheduler;

import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.modules.session.ExamSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class StaleSessionScheduler {

    private final ExamSessionRepository sessionRepository;
    private final ExamSessionService sessionService;

    /**
     * Every 5 minutes: auto-submit sessions with heartbeat older than 10 minutes
     */
    // Non-transactional: each submitSession() call manages its own transaction,
    // so a failure on one stale session never rolls back others (Issue 14).
    @Scheduled(cron = "0 */5 * * * *")
    public void autoSubmitStaleSessions() {
        Instant cutoff = Instant.now().minusSeconds(600); // 10 minutes
        List<ExamSession> stale = sessionRepository.findStaleSessions(cutoff);

        for (ExamSession session : stale) {
            try {
                log.warn("Auto-submitting stale session: {} (last heartbeat: {})",
                        session.getId(), session.getLastHeartbeatAt());
                sessionService.submitSession(session.getId());
            } catch (Exception e) {
                log.error("Error auto-submitting session {}: {}", session.getId(), e.getMessage());
            }
        }

        if (!stale.isEmpty()) {
            log.info("Auto-submitted {} stale session(s)", stale.size());
        }
    }
}
