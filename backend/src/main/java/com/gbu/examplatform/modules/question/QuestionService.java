package com.gbu.examplatform.modules.question;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.exam.ExamRepository;
import com.gbu.examplatform.modules.exam.ExamService;
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
    private final ExamService examService;

    @Transactional
    public QuestionDto createQuestion(UUID examId, CreateQuestionRequest request) {
        Exam exam = findExam(examId);
        examService.requireOwnershipOrAdmin(exam);

        // Reject mutations to live or finished exams
        if (exam.getStatus() == Exam.ExamStatus.PUBLISHED
                || exam.getStatus() == Exam.ExamStatus.ONGOING
                || exam.getStatus() == Exam.ExamStatus.COMPLETED) {
            throw new BusinessException("Questions cannot be added once an exam is PUBLISHED, ONGOING or COMPLETED");
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
        examService.requireOwnershipOrAdmin(exam);
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", questionId.toString()));

        if (!question.getExam().getId().equals(examId)) {
            throw new BusinessException("Question does not belong to this exam");
        }

        if (exam.getStatus() == Exam.ExamStatus.PUBLISHED
                || exam.getStatus() == Exam.ExamStatus.ONGOING
                || exam.getStatus() == Exam.ExamStatus.COMPLETED) {
            throw new BusinessException("Questions cannot be modified once an exam is PUBLISHED, ONGOING or COMPLETED");
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
        examService.requireOwnershipOrAdmin(exam);
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", questionId.toString()));

        if (!question.getExam().getId().equals(examId)) {
            throw new BusinessException("Question does not belong to this exam");
        }

        if (exam.getStatus() == Exam.ExamStatus.PUBLISHED
                || exam.getStatus() == Exam.ExamStatus.ONGOING
                || exam.getStatus() == Exam.ExamStatus.COMPLETED) {
            throw new BusinessException("Questions cannot be deleted once an exam is PUBLISHED, ONGOING or COMPLETED");
        }

        questionRepository.delete(question);
    }

    /**
     * Bulk-import a subset of questions from a source exam into a target exam.
     *
     * Checks enforced:
     * 1. Target exam must be DRAFT (not editable otherwise).
     * 2. Caller must own both exams.
     * 3. Source exam must be different from the target.
     * 4. Every question ID must belong to the source exam.
     * 5. Sum of imported question marks must not exceed the target exam's
     * totalMarks
     * minus marks already assigned to existing questions.
     *
     * @return list of newly created QuestionDto copies in the target exam.
     */
    @Transactional
    public List<QuestionDto> importQuestions(UUID targetExamId, UUID sourceExamId, List<UUID> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) {
            throw new BusinessException("No questions selected for import");
        }

        Exam target = findExam(targetExamId);
        examService.requireOwnershipOrAdmin(target);

        if (target.getStatus() != Exam.ExamStatus.DRAFT) {
            throw new BusinessException("Questions can only be imported into a DRAFT exam");
        }

        if (targetExamId.equals(sourceExamId)) {
            throw new BusinessException("Cannot import questions from the same exam");
        }

        Exam source = findExam(sourceExamId);
        examService.requireOwnershipOrAdmin(source);

        // Deduplicate requested IDs
        List<UUID> distinctIds = questionIds.stream().distinct().collect(Collectors.toList());

        // Fetch questions and verify they all belong to source exam
        List<Question> toImport = questionRepository.findAllById(distinctIds);
        if (toImport.size() != distinctIds.size()) {
            throw new BusinessException("One or more selected questions do not exist");
        }
        boolean allBelongToSource = toImport.stream()
                .allMatch(q -> q.getExam().getId().equals(sourceExamId));
        if (!allBelongToSource) {
            throw new BusinessException("One or more selected questions do not belong to the source exam");
        }

        // Marks capacity check
        int importedMarksSum = toImport.stream().mapToInt(Question::getMarks).sum();
        int existingMarksSum = questionRepository.findByExamIdOrderByOrderIndexAsc(targetExamId)
                .stream().mapToInt(Question::getMarks).sum();
        int capacity = target.getTotalMarks() - existingMarksSum;
        if (importedMarksSum > capacity) {
            throw new BusinessException(
                    "Imported questions total " + importedMarksSum + " marks but target exam only has "
                            + capacity + " marks remaining (exam total: " + target.getTotalMarks() + ")");
        }

        // Copy each question into the target exam
        int nextOrder = (int) questionRepository.countByExamId(targetExamId) + 1;
        List<Question> copies = new ArrayList<>();
        for (Question src : toImport) {
            Question copy = Question.builder()
                    .exam(target)
                    .text(src.getText())
                    .type(src.getType())
                    .options(src.getOptions() != null ? new ArrayList<>(src.getOptions()) : null)
                    .correctAnswer(src.getCorrectAnswer())
                    .marks(src.getMarks())
                    .negativeMarks(src.getNegativeMarks())
                    .orderIndex(nextOrder++)
                    .build();
            copies.add(copy);
        }

        return questionRepository.saveAll(copies).stream()
                .map(q -> toDto(q, false))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<QuestionDto> importQuestionsFromExcel(UUID examId, org.springframework.web.multipart.MultipartFile file) {
        Exam target = findExam(examId);
        examService.requireOwnershipOrAdmin(target);

        if (target.getStatus() != Exam.ExamStatus.DRAFT) {
            throw new BusinessException("Questions can only be imported into a DRAFT exam");
        }

        List<Question> newQuestions = new ArrayList<>();
        int importedMarksSum = 0;

        try (java.io.InputStream is = file.getInputStream();
             org.apache.poi.ss.usermodel.Workbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook(is)) {
            
            org.apache.poi.ss.usermodel.Sheet sheet = workbook.getSheetAt(0);
            java.util.Iterator<org.apache.poi.ss.usermodel.Row> rows = sheet.iterator();

            int rowNumber = 0;
            while (rows.hasNext()) {
                org.apache.poi.ss.usermodel.Row currentRow = rows.next();
                if (rowNumber == 0) {
                    rowNumber++;
                    continue; // Skip header row
                }

                String text = getCellValue(currentRow.getCell(0));
                String typeStr = getCellValue(currentRow.getCell(1));
                String marksStr = getCellValue(currentRow.getCell(2));
                String correctAnswer = getCellValue(currentRow.getCell(3));
                
                if (text.isBlank() || typeStr.isBlank() || marksStr.isBlank() || correctAnswer.isBlank()) {
                    continue; // Skip incomplete rows
                }

                Question.QuestionType type = Question.QuestionType.valueOf(typeStr.trim().toUpperCase());
                int marks = Double.valueOf(marksStr).intValue();

                List<Question.McqOption> options = null;
                if (type == Question.QuestionType.MCQ) {
                    options = new ArrayList<>();
                    String[] keys = {"A", "B", "C", "D"};
                    for (int i = 0; i < 4; i++) {
                        String optText = getCellValue(currentRow.getCell(4 + i));
                        if (!optText.isBlank()) {
                            Question.McqOption opt = new Question.McqOption();
                            opt.setKey(keys[i]);
                            opt.setText(optText);
                            options.add(opt);
                        }
                    }
                    if (options.size() < 2) {
                        throw new BusinessException("Row " + (rowNumber + 1) + ": MCQ must have at least 2 options");
                    }
                }

                Question q = Question.builder()
                        .exam(target)
                        .text(text)
                        .type(type)
                        .options(options)
                        .correctAnswer(correctAnswer)
                        .marks(marks)
                        .negativeMarks(0.0)
                        .build();

                newQuestions.add(q);
                importedMarksSum += marks;
                rowNumber++;
            }
        } catch (Exception e) {
            throw new BusinessException("Failed to parse Excel file: " + e.getMessage());
        }

        if (newQuestions.isEmpty()) {
            throw new BusinessException("No valid questions found in the Excel file");
        }

        // Marks capacity check
        int existingMarksSum = questionRepository.findByExamIdOrderByOrderIndexAsc(examId)
                .stream().mapToInt(Question::getMarks).sum();
        int capacity = target.getTotalMarks() - existingMarksSum;
        if (importedMarksSum > capacity) {
            throw new BusinessException(
                    "Imported questions total " + importedMarksSum + " marks but target exam only has "
                            + capacity + " marks remaining (exam total: " + target.getTotalMarks() + ")");
        }

        // Save
        int nextOrder = (int) questionRepository.countByExamId(examId) + 1;
        for (Question q : newQuestions) {
            q.setOrderIndex(nextOrder++);
        }

        return questionRepository.saveAll(newQuestions).stream()
                .map(q -> toDto(q, false))
                .collect(Collectors.toList());
    }

    private String getCellValue(org.apache.poi.ss.usermodel.Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue();
            case NUMERIC: return String.valueOf(cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            default: return "";
        }
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
