package com.gbu.examplatform.modules.enrollment;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.exam.ExamRepository;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.modules.user.User;
import com.gbu.examplatform.modules.user.UserRepository;
import com.gbu.examplatform.security.SecurityUtils;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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

    @Transactional
    public EnrollmentDto enroll(UUID examId) {
        UUID userId = securityUtils.getCurrentUserId();

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", examId.toString()));

        if (exam.getStatus() != Exam.ExamStatus.PUBLISHED && exam.getStatus() != Exam.ExamStatus.ONGOING) {
            throw new BusinessException("Can only enroll in PUBLISHED or ONGOING exams");
        }

        if (!exam.getAllowLateEntry() && exam.getStatus() == Exam.ExamStatus.ONGOING) {
            throw new BusinessException("Late entry is not allowed for this exam");
        }

        if (enrollmentRepository.existsByExamIdAndUserId(examId, userId)) {
            throw new BusinessException("Already enrolled in this exam");
        }

        if (exam.getEndTime().isBefore(Instant.now())) {
            throw new BusinessException("Exam has already ended");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        ExamEnrollment enrollment = ExamEnrollment.builder()
                .exam(exam)
                .user(user)
                .status(ExamEnrollment.EnrollmentStatus.REGISTERED)
                .build();

        // Catch the DB unique-constraint violation that occurs when two concurrent
        // requests both pass the existsBy check before either save commits (Issue 51)
        try {
            return toDto(enrollmentRepository.save(enrollment));
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Already enrolled in this exam");
        }
    }

    @Transactional
    public void unenroll(UUID examId) {
        UUID userId = securityUtils.getCurrentUserId();

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

        // Block if the student has already started a session for this enrollment
        if (sessionRepository.findByEnrollmentId(enrollment.getId()).isPresent()) {
            throw new BusinessException("Cannot unenroll after a session has been started");
        }

        enrollmentRepository.delete(enrollment);
        log.info("User {} unenrolled from exam {}", userId, examId);
    }

    @Transactional(readOnly = true)
    public Page<EnrollmentDto> getEnrollments(UUID examId, Pageable pageable) {
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
}
