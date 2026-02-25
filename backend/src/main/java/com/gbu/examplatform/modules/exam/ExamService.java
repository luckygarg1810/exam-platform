package com.gbu.examplatform.modules.exam;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.exam.dto.*;
import com.gbu.examplatform.modules.user.User;
import com.gbu.examplatform.modules.user.UserRepository;
import com.gbu.examplatform.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;

    @Transactional
    public ExamDto createExam(CreateExamRequest request) {
        if (!request.getEndTime().isAfter(request.getStartTime())) {
            throw new BusinessException("End time must be after start time");
        }
        if (request.getPassingMarks() > request.getTotalMarks()) {
            throw new BusinessException("Passing marks cannot exceed total marks");
        }

        UUID adminId = securityUtils.getCurrentUserId();
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new ResourceNotFoundException("User", adminId.toString()));

        Exam exam = Exam.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .subject(request.getSubject())
                .createdBy(admin)
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .durationMinutes(request.getDurationMinutes())
                .totalMarks(request.getTotalMarks())
                .passingMarks(request.getPassingMarks())
                .shuffleQuestions(request.getShuffleQuestions() != null ? request.getShuffleQuestions() : true)
                .shuffleOptions(request.getShuffleOptions() != null ? request.getShuffleOptions() : true)
                .allowLateEntry(request.getAllowLateEntry() != null ? request.getAllowLateEntry() : false)
                .status(Exam.ExamStatus.DRAFT)
                .build();

        return toDto(examRepository.save(exam));
    }

    @Transactional(readOnly = true)
    public Page<ExamDto> getExams(Pageable pageable) {
        String role = securityUtils.getCurrentUserRole();

        Page<Exam> page;
        if ("ADMIN".equals(role)) {
            // Admin sees all non-deleted exams regardless of status
            page = examRepository.findByIsDeletedFalse(pageable);
        } else if ("PROCTOR".equals(role)) {
            // Proctor sees only exams they have been assigned to
            UUID proctorId = securityUtils.getCurrentUserId();
            page = examRepository.findByAssignedProctor(proctorId, pageable);
        } else {
            // Student sees only exams they are enrolled in (admin-assigned)
            List<Exam.ExamStatus> studentStatuses = List.of(
                    Exam.ExamStatus.PUBLISHED, Exam.ExamStatus.ONGOING, Exam.ExamStatus.COMPLETED);
            UUID userId = securityUtils.getCurrentUserId();
            page = examRepository.findByEnrolledUserAndStatuses(userId, studentStatuses, pageable);
        }
        // Bulk-fetch question counts for the page in one query (Issue 47)
        Map<UUID, Long> countMap = buildQuestionCountMap(page.getContent());
        return page.map(e -> toDto(e, countMap.getOrDefault(e.getId(), 0L)));
    }

    @Transactional(readOnly = true)
    public Page<ExamDto> getAvailableExams(Pageable pageable) {
        List<Exam.ExamStatus> statuses = List.of(Exam.ExamStatus.PUBLISHED, Exam.ExamStatus.ONGOING);
        Page<Exam> page = examRepository.findByStatusInAndIsDeletedFalse(statuses, pageable);
        Map<UUID, Long> countMap = buildQuestionCountMap(page.getContent());
        return page.map(e -> toDto(e, countMap.getOrDefault(e.getId(), 0L)));
    }

    @Transactional(readOnly = true)
    public ExamDto getExamById(UUID examId) {
        Exam exam = findExamById(examId);
        return toDto(exam);
    }

    @Transactional
    public ExamDto updateExam(UUID examId, CreateExamRequest request) {
        Exam exam = findExamById(examId);

        if (exam.getStatus() != Exam.ExamStatus.DRAFT) {
            throw new BusinessException("Can only edit exams in DRAFT status");
        }

        if (request.getTitle() != null)
            exam.setTitle(request.getTitle());
        if (request.getDescription() != null)
            exam.setDescription(request.getDescription());
        if (request.getSubject() != null)
            exam.setSubject(request.getSubject());
        if (request.getStartTime() != null)
            exam.setStartTime(request.getStartTime());
        if (request.getEndTime() != null)
            exam.setEndTime(request.getEndTime());
        if (request.getDurationMinutes() != null)
            exam.setDurationMinutes(request.getDurationMinutes());
        if (request.getTotalMarks() != null)
            exam.setTotalMarks(request.getTotalMarks());
        if (request.getPassingMarks() != null)
            exam.setPassingMarks(request.getPassingMarks());
        if (request.getShuffleQuestions() != null)
            exam.setShuffleQuestions(request.getShuffleQuestions());
        if (request.getShuffleOptions() != null)
            exam.setShuffleOptions(request.getShuffleOptions());
        if (request.getAllowLateEntry() != null)
            exam.setAllowLateEntry(request.getAllowLateEntry());

        // Re-validate time relationship after partial update
        if (!exam.getEndTime().isAfter(exam.getStartTime())) {
            throw new BusinessException("End time must be after start time");
        }
        if (exam.getPassingMarks() > exam.getTotalMarks()) {
            throw new BusinessException("Passing marks cannot exceed total marks");
        }

        return toDto(examRepository.save(exam));
    }

    @Transactional
    public void deleteExam(UUID examId) {
        Exam exam = findExamById(examId);
        if (exam.getStatus() == Exam.ExamStatus.ONGOING) {
            throw new BusinessException("Cannot delete an ongoing exam");
        }
        exam.setIsDeleted(true);
        examRepository.save(exam);
    }

    @Transactional
    public ExamDto publishExam(UUID examId) {
        Exam exam = findExamById(examId);

        if (exam.getStatus() != Exam.ExamStatus.DRAFT) {
            throw new BusinessException("Only DRAFT exams can be published");
        }

        long questionCount = examRepository.countQuestions(examId);
        if (questionCount == 0) {
            throw new BusinessException("Exam must have at least one question before publishing");
        }

        // Validate sum of question marks equals totalMarks (Issue 52)
        double marksSum = examRepository.sumQuestionMarks(examId);
        if (Math.abs(marksSum - exam.getTotalMarks()) > 0.01) {
            throw new BusinessException(
                    "Sum of question marks (" + marksSum + ") does not match exam totalMarks (" + exam.getTotalMarks()
                            + ")");
        }

        if (!exam.getStartTime().isAfter(Instant.now())) {
            throw new BusinessException("Start time must be in the future");
        }

        exam.setStatus(Exam.ExamStatus.PUBLISHED);
        return toDto(examRepository.save(exam));
    }

    private Exam findExamById(UUID examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", examId.toString()));
        if (Boolean.TRUE.equals(exam.getIsDeleted())) {
            throw new ResourceNotFoundException("Exam", examId.toString());
        }
        return exam;
    }

    // -------------------------------------------------------------------------
    // Scheduler-facing helpers (Issue 21)
    // -------------------------------------------------------------------------

    /**
     * Transitions a batch of exams to ONGOING in a dedicated @Transactional call.
     * Called by ExamScheduler so the status commit is isolated — a subsequent
     * failure
     * in session-submission logic can never roll it back.
     */
    @Transactional
    public List<Exam> markExamsOngoing(List<Exam> exams) {
        exams.forEach(e -> e.setStatus(Exam.ExamStatus.ONGOING));
        List<Exam> saved = examRepository.saveAll(exams);
        log.info("Scheduler: transitioned {} exam(s) to ONGOING", saved.size());
        return saved;
    }

    /**
     * Transitions a batch of exams to COMPLETED in a dedicated @Transactional call.
     * Commits before the caller begins per-session submission work, ensuring the
     * exam
     * is permanently marked complete even if all session submissions subsequently
     * fail.
     */
    @Transactional
    public List<Exam> markExamsCompleted(List<Exam> exams) {
        exams.forEach(e -> e.setStatus(Exam.ExamStatus.COMPLETED));
        List<Exam> saved = examRepository.saveAll(exams);
        log.info("Scheduler: transitioned {} exam(s) to COMPLETED", saved.size());
        return saved;
    }

    /**
     * Bulk-fetch question counts for a list of exams; returns a map keyed by exam
     * ID (Issue 47)
     */
    private Map<UUID, Long> buildQuestionCountMap(List<Exam> exams) {
        if (exams.isEmpty())
            return Map.of();
        List<UUID> ids = exams.stream().map(Exam::getId).collect(Collectors.toList());
        return examRepository.countQuestionsForExams(ids).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (Long) row[1]));
    }

    /**
     * Single-exam path: still issues one COUNT query (used for
     * create/publish/update responses)
     */
    public ExamDto toDto(Exam exam) {
        return toDto(exam, examRepository.countQuestions(exam.getId()));
    }

    private ExamDto toDto(Exam exam, long questionCount) {
        return ExamDto.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .description(exam.getDescription())
                .subject(exam.getSubject())
                .createdByName(exam.getCreatedBy() != null ? exam.getCreatedBy().getName() : null)
                .startTime(exam.getStartTime())
                .endTime(exam.getEndTime())
                .durationMinutes(exam.getDurationMinutes())
                .totalMarks(exam.getTotalMarks())
                .passingMarks(exam.getPassingMarks())
                .shuffleQuestions(exam.getShuffleQuestions())
                .shuffleOptions(exam.getShuffleOptions())
                .status(exam.getStatus())
                .allowLateEntry(exam.getAllowLateEntry())
                .createdAt(exam.getCreatedAt())
                .questionCount(questionCount)
                .build();
    }
}
