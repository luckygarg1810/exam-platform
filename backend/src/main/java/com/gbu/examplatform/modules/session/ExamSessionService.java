package com.gbu.examplatform.modules.session;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.exception.SessionAlreadyActiveException;
import com.gbu.examplatform.modules.answer.Answer;
import com.gbu.examplatform.modules.answer.AnswerRepository;
import com.gbu.examplatform.modules.enrollment.EnrollmentRepository;
import com.gbu.examplatform.modules.enrollment.ExamEnrollment;
import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.notification.EmailService;
import com.gbu.examplatform.modules.question.Question;
import com.gbu.examplatform.modules.question.QuestionRepository;
import com.gbu.examplatform.modules.notification.NotificationService;
import com.gbu.examplatform.modules.proctoring.ViolationSummary;
import com.gbu.examplatform.modules.proctoring.ViolationSummaryRepository;
import com.gbu.examplatform.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExamSessionService {

    private final ExamSessionRepository sessionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final AnswerRepository answerRepository;
    private final QuestionRepository questionRepository;
    private final ViolationSummaryRepository violationSummaryRepository;
    private final SecurityUtils securityUtils;
    private final RedisTemplate<String, String> redisTemplate;
    private final EmailService emailService;
    private final NotificationService notificationService;

    @Transactional
    public SessionDto startSession(UUID examId, HttpServletRequest request) {
        UUID userId = securityUtils.getCurrentUserId();

        ExamEnrollment enrollment = enrollmentRepository.findByExamIdAndUserId(examId, userId)
                .orElseThrow(() -> new BusinessException("You are not enrolled in this exam"));

        Exam exam = enrollment.getExam();
        if (exam.getStatus() != Exam.ExamStatus.ONGOING && exam.getStatus() != Exam.ExamStatus.PUBLISHED) {
            throw new BusinessException("Exam is not currently active");
        }
        if (exam.getEndTime().isBefore(Instant.now())) {
            throw new BusinessException("Exam has ended");
        }

        // Block suspended students — suspension is permanent for this exam attempt
        if (enrollment.getStatus() == ExamEnrollment.EnrollmentStatus.FLAGGED) {
            throw new BusinessException("Your session was suspended. You cannot restart this exam.");
        }

        // Block if any open session (active or suspended) already exists for this exam
        sessionRepository.findAnyOpenSessionByUserAndExam(userId, examId).ifPresent(existing -> {
            if (Boolean.TRUE.equals(existing.getIsSuspended())) {
                throw new BusinessException("Your session was suspended. You cannot restart this exam.");
            }
            throw new SessionAlreadyActiveException("You already have an active session for this exam");
        });

        // Block concurrent sessions across other exams
        List<ExamSession> activeSessions = sessionRepository.findActiveSessionsByUser(userId);
        if (!activeSessions.isEmpty()) {
            throw new SessionAlreadyActiveException("You already have an active exam session");
        }

        // Check if already completed this exam
        if (enrollment.getStatus() == ExamEnrollment.EnrollmentStatus.COMPLETED) {
            throw new BusinessException("You have already completed this exam");
        }

        ExamSession session = ExamSession.builder()
                .enrollment(enrollment)
                .lastHeartbeatAt(Instant.now())
                .ipAddress(request.getRemoteAddr())
                .userAgent(request.getHeader("User-Agent"))
                .build();
        session = sessionRepository.save(session);

        // Update enrollment status
        enrollment.setStatus(ExamEnrollment.EnrollmentStatus.ONGOING);
        enrollmentRepository.save(enrollment);

        // Set Redis presence key
        String presenceKey = "session:active:" + session.getId();
        redisTemplate.opsForValue().set(presenceKey, "1", 30, TimeUnit.MINUTES);

        // Create violation summary record
        ViolationSummary summary = ViolationSummary.builder()
                .session(session)
                .build();
        violationSummaryRepository.save(summary);

        return toDto(session);
    }

    @Transactional(readOnly = true)
    public SessionDto getSession(UUID sessionId) {
        ExamSession session = findSession(sessionId);
        validateAccess(session);
        return toDto(session);
    }

    @Transactional
    public void heartbeat(UUID sessionId) {
        ExamSession session = findSession(sessionId);
        session.setLastHeartbeatAt(Instant.now());
        sessionRepository.save(session);

        // Refresh Redis presence key
        redisTemplate.opsForValue().set("session:active:" + sessionId, "1", 30, TimeUnit.MINUTES);
    }

    @Transactional
    public SessionDto submitSession(UUID sessionId) {
        ExamSession session = findSession(sessionId);

        if (session.getSubmittedAt() != null) {
            throw new BusinessException("Session already submitted");
        }

        if (Boolean.TRUE.equals(session.getIsSuspended())) {
            throw new BusinessException("Session has been suspended and cannot be submitted");
        }

        // Auto-grade MCQs
        BigDecimal totalScore = calculateScore(session);
        Exam exam = session.getEnrollment().getExam();
        boolean passed = totalScore.compareTo(BigDecimal.valueOf(exam.getPassingMarks())) >= 0;

        session.setScore(totalScore);
        session.setIsPassed(passed);
        session.setSubmittedAt(Instant.now());
        session = sessionRepository.save(session);

        // Update enrollment status
        ExamEnrollment enrollment = session.getEnrollment();
        enrollment.setStatus(ExamEnrollment.EnrollmentStatus.COMPLETED);
        enrollmentRepository.save(enrollment);

        // Remove from Redis
        redisTemplate.delete("session:active:" + session.getId());

        // Send result email asynchronously
        try {
            emailService.sendResultEmail(
                    enrollment.getUser().getEmail(),
                    enrollment.getUser().getName(),
                    exam.getTitle(),
                    totalScore,
                    passed);
        } catch (Exception e) {
            log.warn("Failed to send result email: {}", e.getMessage());
        }

        return toDto(session);
    }

    @Transactional
    public void suspendSession(UUID sessionId, String reason) {
        ExamSession session = findSession(sessionId);

        // Idempotent: if already suspended, just update reason
        if (Boolean.TRUE.equals(session.getIsSuspended())) {
            log.debug("Session {} already suspended", sessionId);
            return;
        }

        session.setIsSuspended(true);
        session.setSuspensionReason(reason);
        sessionRepository.save(session);

        ExamEnrollment enrollment = session.getEnrollment();
        enrollment.setStatus(ExamEnrollment.EnrollmentStatus.FLAGGED);
        enrollmentRepository.save(enrollment);

        // Remove Redis presence key
        redisTemplate.delete("session:active:" + sessionId);

        // Notify student via WebSocket — locks the exam UI
        notificationService.sendSuspension(sessionId, reason);

        // Broadcast suspension to proctors
        notificationService.broadcastProctorAlert(sessionId, "MANUAL_FLAG", "CRITICAL",
                1.0, "Session suspended: " + reason);

        log.info("Session {} suspended: {}", sessionId, reason);
    }

    @Transactional(readOnly = true)
    public Page<SessionDto> getActiveSessions(Pageable pageable) {
        Instant recentCutoff = Instant.now().minus(Duration.ofMinutes(2));
        return sessionRepository.findActiveSessions(recentCutoff, pageable).map(this::toDto);
    }

    private BigDecimal calculateScore(ExamSession session) {
        List<Answer> answers = answerRepository.findBySessionId(session.getId());
        BigDecimal total = BigDecimal.ZERO;

        for (Answer answer : answers) {
            Question question = questionRepository.findById(answer.getQuestionId())
                    .orElse(null);
            if (question == null)
                continue;

            if (question.getType() == Question.QuestionType.MCQ && answer.getSelectedAnswer() != null) {
                if (answer.getSelectedAnswer().equals(question.getCorrectAnswer())) {
                    BigDecimal awarded = BigDecimal.valueOf(question.getMarks());
                    answer.setMarksAwarded(awarded);
                    total = total.add(awarded);
                } else {
                    BigDecimal neg = BigDecimal.valueOf(question.getNegativeMarks());
                    answer.setMarksAwarded(neg.negate());
                    total = total.subtract(neg);
                }
            } else {
                answer.setMarksAwarded(BigDecimal.ZERO); // Short answer: manual review
            }
        }

        answerRepository.saveAll(answers);
        return total.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private void validateAccess(ExamSession session) {
        if (!securityUtils.isAdmin() && !securityUtils.isProctor()) {
            UUID currentUserId = securityUtils.getCurrentUserId();
            UUID sessionUserId = session.getEnrollment().getUser().getId();
            if (!currentUserId.equals(sessionUserId)) {
                throw new com.gbu.examplatform.exception.UnauthorizedAccessException("Access denied");
            }
        }
    }

    private ExamSession findSession(UUID sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId.toString()));
    }

    public SessionDto toDto(ExamSession s) {
        Exam exam = s.getEnrollment().getExam();
        return SessionDto.builder()
                .id(s.getId())
                .examId(exam.getId())
                .examTitle(exam.getTitle())
                .userId(s.getEnrollment().getUser().getId())
                .userName(s.getEnrollment().getUser().getName())
                .startedAt(s.getStartedAt())
                .submittedAt(s.getSubmittedAt())
                .lastHeartbeatAt(s.getLastHeartbeatAt())
                .identityVerified(s.getIdentityVerified())
                .isSuspended(s.getIsSuspended())
                .suspensionReason(s.getSuspensionReason())
                .score(s.getScore())
                .isPassed(s.getIsPassed())
                .build();
    }

    @Data
    @Builder
    public static class SessionDto {
        private UUID id;
        private UUID examId;
        private String examTitle;
        private UUID userId;
        private String userName;
        private Instant startedAt;
        private Instant submittedAt;
        private Instant lastHeartbeatAt;
        private Boolean identityVerified;
        private Boolean isSuspended;
        private String suspensionReason;
        private BigDecimal score;
        private Boolean isPassed;
    }
}
