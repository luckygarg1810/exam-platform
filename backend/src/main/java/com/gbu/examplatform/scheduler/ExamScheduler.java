package com.gbu.examplatform.scheduler;

import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.exam.ExamRepository;
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

    /**
     * Every minute: PUBLISHED → ONGOING when start_time passes
     */
    @Scheduled(cron = "0 * * * * *")
    @Transactional
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
     * Every minute: ONGOING → COMPLETED when end_time passes
     */
    @Scheduled(cron = "30 * * * * *")
    @Transactional
    public void transitionOngoingToCompleted() {
        Instant now = Instant.now();
        List<Exam> toComplete = examRepository.findByStatusAndEndTimeBeforeAndIsDeletedFalse(
                Exam.ExamStatus.ONGOING, now);

        if (!toComplete.isEmpty()) {
            toComplete.forEach(e -> e.setStatus(Exam.ExamStatus.COMPLETED));
            examRepository.saveAll(toComplete);
            log.info("Transitioned {} exam(s) to COMPLETED", toComplete.size());
        }
    }
}
