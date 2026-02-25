package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.exception.BusinessException;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.exception.UnauthorizedAccessException;
import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.exam.ExamRepository;
import com.gbu.examplatform.modules.user.User;
import com.gbu.examplatform.modules.user.UserRepository;
import com.gbu.examplatform.security.SecurityUtils;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Manages assignment of proctors to exams.
 *
 * Rules enforced here:
 * 1. Only users with role PROCTOR can be assigned as proctors.
 * 2. A proctor cannot be assigned to two exams whose time windows overlap.
 * 3. Assignments can only be made/removed by ADMIN (enforced at controller).
 * 4. An exam can have multiple proctors.
 */
@Service
@RequiredArgsConstructor
public class ExamProctorService {

    private final ExamProctorRepository examProctorRepository;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;

    /**
     * Throws UnauthorizedAccessException if the current user is a PROCTOR who is
     * NOT assigned to the given exam. ADMINs always pass.
     * Call this at the start of any proctor-facing controller action.
     */
    public void requireProctorScopeForExam(UUID examId) {
        if (securityUtils.isAdmin())
            return;
        UUID proctorId = securityUtils.getCurrentUserId();
        if (!examProctorRepository.isProctorForExam(examId, proctorId)) {
            throw new UnauthorizedAccessException(
                    "You are not assigned as a proctor for this exam");
        }
    }

    // ── Assign ───────────────────────────────────────────────────────────────

    @Transactional
    public ExamProctorDto assignProctor(UUID examId, UUID proctorId) {
        Exam exam = findExam(examId);
        User proctor = findProctor(proctorId);

        if (examProctorRepository.existsByExamIdAndProctorId(examId, proctorId)) {
            throw new BusinessException("Proctor is already assigned to this exam");
        }

        // Cannot assign to a completed exam
        if (exam.getStatus() == Exam.ExamStatus.COMPLETED) {
            throw new BusinessException("Cannot assign proctors to a completed exam");
        }

        // Enforce no-overlap rule across all exams for this proctor
        if (examProctorRepository.existsOverlappingAssignment(
                proctorId, examId, exam.getStartTime(), exam.getEndTime())) {
            throw new BusinessException(
                    "Proctor already has an overlapping exam assignment in the same time window");
        }

        ExamProctor assignment = ExamProctor.builder()
                .exam(exam)
                .proctor(proctor)
                .build();
        examProctorRepository.save(assignment);

        return toDto(assignment);
    }

    // ── Unassign ─────────────────────────────────────────────────────────────

    @Transactional
    public void unassignProctor(UUID examId, UUID proctorId) {
        if (!examProctorRepository.existsByExamIdAndProctorId(examId, proctorId)) {
            throw new ResourceNotFoundException("ExamProctor",
                    "examId=" + examId + ", proctorId=" + proctorId);
        }
        examProctorRepository.deleteByExamIdAndProctorId(examId, proctorId);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ExamProctorDto> getProctorsForExam(UUID examId) {
        findExam(examId); // validate exam exists
        return examProctorRepository.findByExamId(examId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<ExamProctorDto> getExamsForProctor(UUID proctorId) {
        return examProctorRepository.findByProctorId(proctorId)
                .stream().map(this::toDto).toList();
    }

    // ── Access helper (used by other services) ────────────────────────────────

    public boolean isProctorForExam(UUID examId, UUID proctorId) {
        return examProctorRepository.isProctorForExam(examId, proctorId);
    }

    public List<UUID> getAssignedExamIds(UUID proctorId) {
        return examProctorRepository.findExamIdsByProctorId(proctorId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Exam findExam(UUID examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", examId.toString()));
        if (Boolean.TRUE.equals(exam.getIsDeleted())) {
            throw new ResourceNotFoundException("Exam", examId.toString());
        }
        return exam;
    }

    private User findProctor(UUID proctorId) {
        User user = userRepository.findById(proctorId)
                .orElseThrow(() -> new ResourceNotFoundException("User", proctorId.toString()));
        if (user.getRole() != com.gbu.examplatform.modules.user.User.Role.PROCTOR) {
            throw new BusinessException("User is not a proctor");
        }
        return user;
    }

    private ExamProctorDto toDto(ExamProctor ep) {
        return ExamProctorDto.builder()
                .examId(ep.getExam().getId())
                .examTitle(ep.getExam().getTitle())
                .examStartTime(ep.getExam().getStartTime())
                .examEndTime(ep.getExam().getEndTime())
                .proctorId(ep.getProctor().getId())
                .proctorName(ep.getProctor().getName())
                .proctorEmail(ep.getProctor().getEmail())
                .assignedAt(ep.getAssignedAt())
                .build();
    }

    // ── DTO ───────────────────────────────────────────────────────────────────

    @Data
    @Builder
    public static class ExamProctorDto {
        private UUID examId;
        private String examTitle;
        private Instant examStartTime;
        private Instant examEndTime;
        private UUID proctorId;
        private String proctorName;
        private String proctorEmail;
        private Instant assignedAt;
    }
}
