package com.gbu.examplatform.modules.answer;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.question.QuestionRepository;
import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.security.SecurityUtils;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnswerService {

    private final AnswerRepository answerRepository;
    private final ExamSessionRepository sessionRepository;
    private final QuestionRepository questionRepository;
    private final SecurityUtils securityUtils;

    @Transactional
    public AnswerDto saveAnswer(UUID sessionId, SaveAnswerRequest request) {
        ExamSession session = findAndValidateSession(sessionId);

        if (session.getSubmittedAt() != null) {
            throw new BusinessException("Session already submitted");
        }
        if (Boolean.TRUE.equals(session.getIsSuspended())) {
            throw new BusinessException("Session is suspended");
        }

        // Validate that the question belongs to this session's exam (Issue 45)
        UUID examId = session.getEnrollment().getExam().getId();
        questionRepository.findByIdAndExamId(request.getQuestionId(), examId)
                .orElseThrow(() -> new ResourceNotFoundException("Question",
                        request.getQuestionId().toString()));

        // Upsert: find existing or create new
        Answer answer = answerRepository.findBySessionIdAndQuestionId(sessionId, request.getQuestionId())
                .orElse(Answer.builder()
                        .sessionId(sessionId)
                        .questionId(request.getQuestionId())
                        .build());

        answer.setSelectedAnswer(request.getSelectedAnswer());
        answer.setSavedAt(Instant.now());

        return toDto(answerRepository.save(answer));
    }

    @Transactional(readOnly = true)
    public List<AnswerDto> getAnswers(UUID sessionId) {
        findAndValidateSession(sessionId);
        return answerRepository.findBySessionId(sessionId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    private ExamSession findAndValidateSession(UUID sessionId) {
        ExamSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId.toString()));

        if (!securityUtils.isAdmin() && !securityUtils.isProctor()) {
            UUID currentUserId = securityUtils.getCurrentUserId();
            if (!session.getEnrollment().getUser().getId().equals(currentUserId)) {
                throw new com.gbu.examplatform.exception.UnauthorizedAccessException("Access denied");
            }
        }
        return session;
    }

    private AnswerDto toDto(Answer a) {
        return AnswerDto.builder()
                .id(a.getId())
                .sessionId(a.getSessionId())
                .questionId(a.getQuestionId())
                .selectedAnswer(a.getSelectedAnswer())
                .marksAwarded(a.getMarksAwarded())
                .savedAt(a.getSavedAt())
                .build();
    }

    @Data
    @Builder
    public static class AnswerDto {
        private UUID id;
        private UUID sessionId;
        private UUID questionId;
        private String selectedAnswer;
        private BigDecimal marksAwarded;
        private Instant savedAt;
    }

    @Data
    public static class SaveAnswerRequest {
        private UUID questionId;
        private String selectedAnswer;
    }
}
