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
import com.gbu.examplatform.modules.proctoring.ProctoringEvent;
import com.gbu.examplatform.modules.proctoring.ProctoringEventRepository;
import com.gbu.examplatform.modules.proctoring.ViolationSummary;
import com.gbu.examplatform.modules.proctoring.ViolationSummaryRepository;
import com.gbu.examplatform.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExamSessionService {

    private final ExamSessionRepository sessionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final AnswerRepository answerRepository;
    private final QuestionRepository questionRepository;
    private final ViolationSummaryRepository violationSummaryRepository;
    private final ProctoringEventRepository proctoringEventRepository;
    private final SecurityUtils securityUtils;
    private final RedisTemplate<String, String> redisTemplate;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final RestTemplate restTemplate;

    @Value("${ai-service.base-url}")
    private String aiServiceBaseUrl;

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
        validateAccess(session); // prevent any student from keeping another student's session alive (Issue 50)
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

        // Push per-session live update so monitoring proctors see submission
        // immediately (Issue 24)
        notificationService.sendSessionUpdate(sessionId, java.util.Map.of(
                "type", "SESSION_SUBMITTED",
                "sessionId", sessionId.toString(),
                "score", totalScore.toPlainString(),
                "passed", passed,
                "timestamp", Instant.now().toString()));

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

    /**
     * Suspends the session in its own transaction (REQUIRES_NEW) so the commit is
     * independent of the caller's transaction. This prevents a rollback in the
     * outer
     * listener transaction (e.g. ProctoringResultConsumer) from un-writing the
     * suspension after the STOMP notification has already been pushed (Issue 54).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
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

        // Push per-session live update so monitoring proctors react immediately (Issue
        // 24)
        notificationService.sendSessionUpdate(sessionId, java.util.Map.of(
                "type", "SESSION_SUSPENDED",
                "sessionId", sessionId.toString(),
                "reason", reason,
                "timestamp", Instant.now().toString()));

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

        // Batch-load all questions in one query to avoid N+1 (Issue 49)
        List<UUID> questionIds = answers.stream()
                .map(Answer::getQuestionId)
                .collect(Collectors.toList());
        Map<UUID, Question> questionMap = questionRepository.findAllById(questionIds)
                .stream().collect(Collectors.toMap(Question::getId, q -> q));

        for (Answer answer : answers) {
            Question question = questionMap.get(answer.getQuestionId());
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

    /**
     * Manually awards marks for a SHORT_ANSWER question after proctor review.
     * Recalculates and persists the session total score. (Issue 23)
     */
    @Transactional
    public GradeResultDto gradeShortAnswer(UUID sessionId, UUID questionId,
            BigDecimal marksAwarded, String comment) {
        ExamSession session = findSession(sessionId);

        if (session.getSubmittedAt() == null) {
            throw new BusinessException("Cannot grade a session that has not been submitted yet");
        }

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", questionId.toString()));

        if (question.getType() != Question.QuestionType.SHORT_ANSWER) {
            throw new BusinessException("Manual grading is only allowed for SHORT_ANSWER questions");
        }

        double maxMarks = question.getMarks();
        if (marksAwarded.compareTo(BigDecimal.ZERO) < 0
                || marksAwarded.compareTo(BigDecimal.valueOf(maxMarks)) > 0) {
            throw new BusinessException(
                    "Marks awarded must be between 0 and " + maxMarks);
        }

        Answer answer = answerRepository.findBySessionIdAndQuestionId(sessionId, questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Answer",
                        "session=" + sessionId + "/question=" + questionId));

        answer.setMarksAwarded(marksAwarded.setScale(1, java.math.RoundingMode.HALF_UP));
        answer.setGradingComment(comment); // persist the reviewer's note (Issue 53)
        answerRepository.save(answer);

        // Recalculate total score from all answers
        List<Answer> allAnswers = answerRepository.findBySessionId(sessionId);
        BigDecimal total = allAnswers.stream()
                .filter(a -> a.getMarksAwarded() != null)
                .map(Answer::getMarksAwarded)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .max(BigDecimal.ZERO)
                .setScale(2, java.math.RoundingMode.HALF_UP);

        Exam exam = session.getEnrollment().getExam();
        boolean passed = total.compareTo(BigDecimal.valueOf(exam.getPassingMarks())) >= 0;
        session.setScore(total);
        session.setIsPassed(passed);
        sessionRepository.save(session);

        log.info("Short answer graded: session={} question={} marks={} comment={}",
                sessionId, questionId, marksAwarded, comment);

        return GradeResultDto.builder()
                .sessionId(sessionId)
                .questionId(questionId)
                .marksAwarded(answer.getMarksAwarded())
                .newTotalScore(total)
                .isPassed(passed)
                .build();
    }

    /**
     * Verifies the student's identity by comparing a live selfie (base64 JPEG/PNG)
     * with the reference ID photo stored in MinIO for that user.
     * Sets {@code session.identityVerified = true} on a successful match;
     * records an {@link ProctoringEvent.EventType#IDENTITY_MISMATCH} event and
     * increments the violation counter on failure. (Issue #22)
     */
    @Transactional
    public VerifyIdentityResultDto verifyIdentity(UUID sessionId, String selfieBase64) {
        ExamSession session = findSession(sessionId);
        validateAccess(session);

        if (session.getSubmittedAt() != null) {
            throw new BusinessException("Session has already been submitted");
        }
        if (Boolean.TRUE.equals(session.getIsSuspended())) {
            throw new BusinessException("Session is suspended");
        }

        UUID studentId = session.getEnrollment().getUser().getId();

        // Call AI service identity verification endpoint
        Map<String, String> requestBody = Map.of(
                "live_selfie_base64", selfieBase64,
                "student_id", studentId.toString());

        boolean match;
        double confidence;
        try {
            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate
                    .postForEntity(
                            aiServiceBaseUrl + "/ai/verify-identity",
                            requestBody,
                            Map.class);
            Map<String, Object> body = response.getBody();
            match = Boolean.TRUE.equals(body != null ? body.get("match") : null);
            confidence = body != null && body.get("confidence") instanceof Number n
                    ? n.doubleValue()
                    : 0.0;
        } catch (Exception e) {
            log.warn("Identity verification AI call failed for session {}: {}", sessionId, e.getMessage());
            throw new BusinessException("Identity verification service is currently unavailable");
        }

        session.setIdentityVerified(match);
        sessionRepository.save(session);

        if (!match) {
            // Persist proctoring event
            ProctoringEvent event = ProctoringEvent.builder()
                    .sessionId(sessionId)
                    .eventType(ProctoringEvent.EventType.IDENTITY_MISMATCH)
                    .severity(ProctoringEvent.Severity.CRITICAL)
                    .confidence(confidence)
                    .description("Identity verification failed: live face does not match reference photo")
                    .source(ProctoringEvent.EventSource.SYSTEM)
                    .build();
            proctoringEventRepository.save(event);

            // Increment violation counter
            violationSummaryRepository.findBySession_Id(sessionId).ifPresent(summary -> {
                summary.setIdentityMismatchCount(summary.getIdentityMismatchCount() + 1);
                violationSummaryRepository.save(summary);
            });

            // Notify proctors
            notificationService.broadcastProctorAlert(
                    sessionId, "IDENTITY_MISMATCH", "CRITICAL",
                    confidence, "Identity verification failed for student " + studentId);

            log.warn("Identity mismatch: session={} student={} confidence={}", sessionId, studentId, confidence);
        } else {
            log.info("Identity verified: session={} student={} confidence={}", sessionId, studentId, confidence);
        }

        return VerifyIdentityResultDto.builder()
                .sessionId(sessionId)
                .match(match)
                .confidence(confidence)
                .build();
    }

    @Data
    @Builder
    public static class VerifyIdentityResultDto {
        private UUID sessionId;
        private boolean match;
        private double confidence;
    }

    @Data
    @Builder
    public static class GradeResultDto {
        private UUID sessionId;
        private UUID questionId;
        private BigDecimal marksAwarded;
        private BigDecimal newTotalScore;
        private Boolean isPassed;
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
