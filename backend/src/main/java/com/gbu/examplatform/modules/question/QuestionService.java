package com.gbu.examplatform.modules.question;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.exam.ExamRepository;
import com.gbu.examplatform.modules.question.dto.*;
import com.gbu.examplatform.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final ExamRepository examRepository;
    private final SecurityUtils securityUtils;
    private final RedisTemplate<String, String> redisTemplate;

    @Transactional
    public QuestionDto createQuestion(UUID examId, CreateQuestionRequest request) {
        Exam exam = findExam(examId);

        // Reject mutations to live exams — matches the guard on
        // updateQuestion/deleteQuestion (Issue 46)
        if (exam.getStatus() == Exam.ExamStatus.PUBLISHED || exam.getStatus() == Exam.ExamStatus.ONGOING) {
            throw new BusinessException("Questions cannot be added once an exam is PUBLISHED or ONGOING");
        }

        if (request.getOptions() == null || request.getOptions().size() < 2) {
            throw new BusinessException("MCQ must have at least 2 options");
        }
        if (request.getCorrectAnswer() == null || request.getCorrectAnswer().isBlank()) {
            throw new BusinessException("MCQ must have a correct answer specified");
        }

        // Auto-assign orderIndex at the end
        int nextOrder = (int) questionRepository.countByExamId(examId) + 1;

        Question question = Question.builder()
                .exam(exam)
                .text(request.getText())
                .type(request.getType())
                .options(request.getOptions())
                .correctAnswer(request.getCorrectAnswer())
                .marks(request.getMarks())
                .negativeMarks(request.getNegativeMarks() != null ? request.getNegativeMarks() : 0.0)
                .orderIndex(request.getOrderIndex() != null ? request.getOrderIndex() : nextOrder)
                .build();

        return toDto(questionRepository.save(question), false);
    }

    @Transactional(readOnly = true)
    public Page<QuestionDto> getQuestions(UUID examId, Pageable pageable) {
        findExam(examId);
        boolean isAdmin = securityUtils.isAdmin();
        return questionRepository.findByExamId(examId, pageable)
                .map(q -> toDto(q, !isAdmin)); // hide correct answer from students
    }

    @Transactional(readOnly = true)
    public List<QuestionDto> getShuffledQuestions(UUID examId) {
        UUID userId = securityUtils.getCurrentUserId();
        String cacheKey = "exam:questions:" + examId + ":" + userId;

        // Check Redis for pre-shuffled order (stored as a comma-joined string)
        String cachedValue = redisTemplate.opsForValue().get(cacheKey);

        List<Question> allQuestions = questionRepository.findByExamIdOrderByOrderIndexAsc(examId);

        if (cachedValue != null && !cachedValue.isEmpty()) {
            // Restore order from Redis
            List<String> cachedIds = Arrays.asList(cachedValue.split(","));
            Map<String, Question> questionMap = allQuestions.stream()
                    .collect(Collectors.toMap(q -> q.getId().toString(), q -> q));
            return cachedIds.stream()
                    .map(questionMap::get)
                    .filter(Objects::nonNull)
                    .map(q -> toDto(q, true)) // hide correct answer for students
                    .collect(Collectors.toList());
        }

        // Shuffle and cache
        Exam exam = findExam(examId);
        List<Question> shuffled = new ArrayList<>(allQuestions);
        if (Boolean.TRUE.equals(exam.getShuffleQuestions())) {
            Collections.shuffle(shuffled);
        }

        // Atomically cache in Redis using SET NX EX to avoid race conditions between
        // concurrent requests for the same user producing interleaved / conflicting
        // orders.
        if (!shuffled.isEmpty()) {
            String ids = shuffled.stream().map(q -> q.getId().toString()).collect(Collectors.joining(","));
            redisTemplate.opsForValue().setIfAbsent(cacheKey, ids,
                    exam.getDurationMinutes() + 30, TimeUnit.MINUTES);
        }

        return shuffled.stream().map(q -> toDto(q, true)).collect(Collectors.toList());
    }

    @Transactional
    public QuestionDto updateQuestion(UUID examId, UUID questionId, CreateQuestionRequest request) {
        Exam exam = findExam(examId);
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", questionId.toString()));

        if (!question.getExam().getId().equals(examId)) {
            throw new BusinessException("Question does not belong to this exam");
        }

        if (exam.getStatus() == Exam.ExamStatus.PUBLISHED || exam.getStatus() == Exam.ExamStatus.ONGOING) {
            throw new BusinessException("Questions cannot be modified once an exam is PUBLISHED or ONGOING");
        }

        if (request.getText() != null)
            question.setText(request.getText());
        if (request.getOptions() != null)
            question.setOptions(request.getOptions());
        if (request.getCorrectAnswer() != null)
            question.setCorrectAnswer(request.getCorrectAnswer());
        if (request.getMarks() != null)
            question.setMarks(request.getMarks());
        if (request.getNegativeMarks() != null)
            question.setNegativeMarks(request.getNegativeMarks());
        if (request.getOrderIndex() != null)
            question.setOrderIndex(request.getOrderIndex());

        return toDto(questionRepository.save(question), false);
    }

    @Transactional
    public void deleteQuestion(UUID examId, UUID questionId) {
        Exam exam = findExam(examId);
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", questionId.toString()));

        if (!question.getExam().getId().equals(examId)) {
            throw new BusinessException("Question does not belong to this exam");
        }

        if (exam.getStatus() == Exam.ExamStatus.PUBLISHED || exam.getStatus() == Exam.ExamStatus.ONGOING) {
            throw new BusinessException("Questions cannot be deleted once an exam is PUBLISHED or ONGOING");
        }

        questionRepository.delete(question);
    }

    private Exam findExam(UUID examId) {
        return examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", examId.toString()));
    }

    private QuestionDto toDto(Question q, boolean hideAnswer) {
        List<Question.McqOption> opts = q.getOptions();
        if (q.getType() == Question.QuestionType.MCQ && opts != null) {
            opts = new ArrayList<>(opts);
            // Shuffle options when the exam has shuffleOptions enabled (Issue 48)
            if (Boolean.TRUE.equals(q.getExam().getShuffleOptions())) {
                Collections.shuffle(opts);
            }
        }
        return QuestionDto.builder()
                .id(q.getId())
                .examId(q.getExam().getId())
                .text(q.getText())
                .type(q.getType())
                .options(opts)
                .correctAnswer(hideAnswer ? null : q.getCorrectAnswer())
                .marks(q.getMarks())
                .negativeMarks(q.getNegativeMarks())
                .orderIndex(q.getOrderIndex())
                .build();
    }
}
