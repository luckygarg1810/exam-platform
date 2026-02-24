package com.gbu.examplatform.scheduler;

import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.exam.ExamRepository;
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
public class ExamScheduler {

    private final ExamRepository examRepository;
    private final ExamSessionRepository sessionRepository;
    private final ExamSessionService sessionService;

    /**
     * Every minute at :00 — PUBLISHED → ONGOING when start_time passes.
     */
    // No @Transactional here: Spring Data saveAll() provides its own transaction;
    // keeping the scheduler non-transactional avoids sharing a transaction with
    // submitSession() calls that could mark the outer tx rollback-only (Issue 14).
    @Scheduled(cron = "0 * * * * *")
    public void transitionPublishedToOngoing() {
        Instant now = Instant.now();
        List<Exam> toStart = examRepository.findByStatusAndStartTimeBeforeAndIsDeletedFalse(
                Exam.ExamStatus.PUBLISHED, now);

        if (!toStart.isEmpty()) {
            toStart.forEach(e -> e.setStatus(Exam.ExamStatus.ONGOING));
            examRepository.saveAll(toStart);
            log.info("Transitioned {} exam(s) to ONGOING", toStart.size());
        }
    }

    /**
     * Every minute at :30 — ONGOING → COMPLETED when end_time passes,
     * then immediately auto-submits ALL still-active sessions for those exams.
     *
     * This guarantees sessions are closed exactly at endTime even if the student's
     * browser is still open and sending heartbeats (the stale-session scheduler
     * alone would only catch them 10+ minutes later).
     */
    // Non-transactional by design: examRepository.saveAll() runs in its own
    // Spring Data transaction; each submitSession() call runs in its own
    // @Transactional(REQUIRED) transaction, so a single session failure never
    // rolls back the exam status update or other sessions (Issue 14).
    @Scheduled(cron = "30 * * * * *")
    public void transitionOngoingToCompleted() {
        Instant now = Instant.now();
        List<Exam> toComplete = examRepository.findByStatusAndEndTimeBeforeAndIsDeletedFalse(
                Exam.ExamStatus.ONGOING, now);

        if (toComplete.isEmpty())
            return;

        // 1. Mark exams COMPLETED
        toComplete.forEach(e -> e.setStatus(Exam.ExamStatus.COMPLETED));
        examRepository.saveAll(toComplete);
        log.info("Transitioned {} exam(s) to COMPLETED", toComplete.size());

        // 2. Auto-submit every open session for those exams
        for (Exam exam : toComplete) {
            List<ExamSession> activeSessions = sessionRepository.findActiveSessionsByExamId(exam.getId());

            for (ExamSession session : activeSessions) {
                try {
                    sessionService.submitSession(session.getId());
                    log.info("Auto-submitted session {} (exam '{}' ended)",
                            session.getId(), exam.getTitle());
                } catch (Exception ex) {
                    log.error("Failed to auto-submit session {} for exam {}: {}",
                            session.getId(), exam.getId(), ex.getMessage());
                }
            }

            if (!activeSessions.isEmpty()) {
                log.info("Auto-submitted {} session(s) for completed exam '{}'",
                        activeSessions.size(), exam.getTitle());
            }
        }
    }
}
