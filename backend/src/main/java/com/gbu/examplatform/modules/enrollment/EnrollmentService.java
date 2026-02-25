package com.gbu.examplatform.modules.enrollment;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.exam.ExamRepository;
import com.gbu.examplatform.modules.exam.ExamService;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.modules.user.User;
import com.gbu.examplatform.modules.user.UserRepository;
import com.gbu.examplatform.security.SecurityUtils;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EnrollmentService {
    private static final Logger log = LoggerFactory.getLogger(EnrollmentService.class);

    private final EnrollmentRepository enrollmentRepository;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final ExamSessionRepository sessionRepository;
    private final SecurityUtils securityUtils;
    private final ExamService examService;

    // ── Admin: enroll a single student ──────────────────────────────────────

    @Transactional
    public EnrollmentDto adminEnroll(UUID examId, UUID userId) {
        Exam exam = findPublishableExam(examId);
        examService.requireAdminOwnership(exam);
        User user = findStudent(userId);

        if (enrollmentRepository.existsByExamIdAndUserId(examId, userId)) {
            throw new BusinessException("Student is already enrolled in this exam");
        }

        ExamEnrollment enrollment = ExamEnrollment.builder()
                .exam(exam)
                .user(user)
                .status(ExamEnrollment.EnrollmentStatus.REGISTERED)
                .build();

        try {
            EnrollmentDto dto = toDto(enrollmentRepository.save(enrollment));
            log.info("Admin enrolled student {} in exam {}", userId, examId);
            return dto;
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Student is already enrolled in this exam");
        }
    }

    // ── Admin: bulk-enroll multiple students ─────────────────────────────────

    @Transactional
    public BulkEnrollResult adminBulkEnroll(UUID examId, List<UUID> userIds) {
        Exam exam = findPublishableExam(examId);
        examService.requireAdminOwnership(exam);

        List<String> errors = new ArrayList<>();
        int successCount = 0;

        for (UUID userId : userIds) {
            try {
                User user = findStudent(userId);

                if (enrollmentRepository.existsByExamIdAndUserId(examId, userId)) {
                    errors.add(userId + ": already enrolled");
                    continue;
                }

                ExamEnrollment enrollment = ExamEnrollment.builder()
                        .exam(exam)
                        .user(user)
                        .status(ExamEnrollment.EnrollmentStatus.REGISTERED)
                        .build();
                enrollmentRepository.save(enrollment);
                successCount++;
            } catch (DataIntegrityViolationException e) {
                errors.add(userId + ": already enrolled (concurrent request)");
            } catch (Exception e) {
                errors.add(userId + ": " + e.getMessage());
            }
        }

        log.info("Bulk enroll exam {}: {} succeeded, {} failed", examId, successCount, errors.size());
        return BulkEnrollResult.builder()
                .examId(examId)
                .successCount(successCount)
                .failureCount(errors.size())
                .errors(errors)
                .build();
    }

    // ── Admin: unenroll a student ─────────────────────────────────────────────

    @Transactional
    public void adminUnenroll(UUID examId, UUID userId) {
        examService.requireAdminOwnership(examId);
        ExamEnrollment enrollment = enrollmentRepository.findByExamIdAndUserId(examId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment",
                        "examId=" + examId + ", userId=" + userId));

        Exam.ExamStatus status = enrollment.getExam().getStatus();
        if (status == Exam.ExamStatus.ONGOING) {
            throw new BusinessException("Cannot unenroll from an ongoing exam");
        }
        if (status == Exam.ExamStatus.COMPLETED) {
            throw new BusinessException("Cannot unenroll from a completed exam");
        }

        if (sessionRepository.findByEnrollmentId(enrollment.getId()).isPresent()) {
            throw new BusinessException("Cannot unenroll after a session has been started");
        }

        enrollmentRepository.delete(enrollment);
        log.info("Admin unenrolled user {} from exam {}", userId, examId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Exam findPublishableExam(UUID examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", examId.toString()));
        if (Boolean.TRUE.equals(exam.getIsDeleted())) {
            throw new ResourceNotFoundException("Exam", examId.toString());
        }
        if (exam.getStatus() == Exam.ExamStatus.COMPLETED) {
            throw new BusinessException("Cannot enroll students in a completed exam");
        }
        if (exam.getEndTime().isBefore(Instant.now())) {
            throw new BusinessException("Exam has already ended");
        }
        return exam;
    }

    private User findStudent(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
        if (user.getRole() != User.Role.STUDENT) {
            throw new BusinessException("User is not a student");
        }
        return user;
    }

    @Transactional(readOnly = true)
    public Page<EnrollmentDto> getEnrollments(UUID examId, Pageable pageable) {
        examService.requireAdminOwnership(examId); // admins can only view their own exam's enrollments
        return enrollmentRepository.findEnrollmentsByExam(examId, pageable)
                .map(this::toDto);
    }

    private EnrollmentDto toDto(ExamEnrollment e) {
        return EnrollmentDto.builder()
                .id(e.getId())
                .examId(e.getExam().getId())
                .examTitle(e.getExam().getTitle())
                .userId(e.getUser().getId())
                .userName(e.getUser().getName())
                .userEmail(e.getUser().getEmail())
                .status(e.getStatus())
                .enrolledAt(e.getEnrolledAt())
                .build();
    }

    @Data
    @Builder
    public static class EnrollmentDto {
        private UUID id;
        private UUID examId;
        private String examTitle;
        private UUID userId;
        private String userName;
        private String userEmail;
        private ExamEnrollment.EnrollmentStatus status;
        private Instant enrolledAt;
    }

    @Data
    @Builder
    public static class BulkEnrollRequest {
        private List<UUID> userIds;
    }

    @Data
    @Builder
    public static class BulkEnrollResult {
        private UUID examId;
        private int successCount;
        private int failureCount;
        private List<String> errors;
    }
}
