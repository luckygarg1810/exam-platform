package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.gbu.examplatform.modules.exam.dto.ExamDto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST API for proctor ↔ exam assignment management.
 *
 * Admin endpoints:
 * POST /api/exams/{examId}/proctors — assign proctor to exam (body: {"email":
 * "..."})
 * DELETE /api/exams/{examId}/proctors/{proctorId} — unassign proctor
 * GET /api/exams/{examId}/proctors — list proctors for exam
 * GET /api/users/{proctorId}/assigned-exams — list exams for proctor
 *
 * Proctor endpoint:
 * GET /api/exams/my-assigned — my assigned exams
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Proctor Assignment", description = "Assign/unassign proctors to exams (Admin only)")
public class ExamProctorController {

    private final ExamProctorService examProctorService;
    private final SecurityUtils securityUtils;

    /** Assign a proctor to an exam by their email address. */
    @PostMapping("/api/exams/{examId}/proctors")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(summary = "Assign an invigilator to an exam by email (Teacher only)")
    public ResponseEntity<ExamProctorService.ExamProctorDto> assignProctor(
            @PathVariable UUID examId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(examProctorService.assignProctorByEmail(examId, body.get("email")));
    }

    /** Unassign a proctor from an exam. */
    @DeleteMapping("/api/exams/{examId}/proctors/{proctorId}")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(summary = "Unassign an invigilator from an exam (Teacher only)")
    public ResponseEntity<Void> unassignProctor(
            @PathVariable UUID examId,
            @PathVariable UUID proctorId) {
        examProctorService.unassignProctor(examId, proctorId);
        return ResponseEntity.noContent().build();
    }

    /** List all proctors assigned to an exam. */
    @GetMapping("/api/exams/{examId}/proctors")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    @Operation(summary = "List proctors assigned to an exam")
    public ResponseEntity<List<ExamProctorService.ExamProctorDto>> getProctorsForExam(
            @PathVariable UUID examId) {
        examProctorService.requireProctorScopeForExam(examId); // proctor must be assigned to this exam
        return ResponseEntity.ok(examProctorService.getProctorsForExam(examId));
    }

    /** List all exams assigned to a specific proctor (Admin view). */
    @GetMapping("/api/users/{proctorId}/assigned-exams")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(summary = "List exams assigned to an invigilator (Teacher only)")
    public ResponseEntity<List<ExamProctorService.ExamProctorDto>> getExamsForProctor(
            @PathVariable UUID proctorId) {
        return ResponseEntity.ok(examProctorService.getExamsForProctor(proctorId));
    }

    /** Proctor sees their own assigned exams (returns full ExamDto). */
    @GetMapping("/api/exams/my-assigned")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(summary = "Get exams assigned to the current invigilator")
    public ResponseEntity<List<ExamDto>> getMyAssignedExams() {
        UUID proctorId = securityUtils.getCurrentUserId();
        return ResponseEntity.ok(examProctorService.getMyAssignedExamDtos(proctorId));
    }
}
