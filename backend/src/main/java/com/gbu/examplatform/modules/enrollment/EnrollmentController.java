package com.gbu.examplatform.modules.enrollment;

import com.gbu.examplatform.modules.proctoring.ExamProctorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@Tag(name = "Enrollment", description = "Student exam enrollment management (Admin only)")
public class EnrollmentController {

    private final EnrollmentService enrollmentService;
    private final ExamProctorService examProctorService;

    /**
     * Admin enrolls a single student in an exam.
     * Body: { "userId": "uuid" }
     */
    @PostMapping("/{examId}/enrollments")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Enroll a student in an exam (Admin only)")
    public ResponseEntity<EnrollmentService.EnrollmentDto> enrollStudent(
            @PathVariable UUID examId,
            @RequestBody EnrollStudentRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(enrollmentService.adminEnroll(examId, body.getUserId()));
    }

    /**
     * Admin bulk-enrolls multiple students.
     * Body: { "userIds": ["uuid1", "uuid2", ...] }
     */
    @PostMapping("/{examId}/enrollments/bulk")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Bulk-enroll students in an exam (Admin only)")
    public ResponseEntity<EnrollmentService.BulkEnrollResult> bulkEnrollStudents(
            @PathVariable UUID examId,
            @RequestBody EnrollmentService.BulkEnrollRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(enrollmentService.adminBulkEnroll(examId, body.getUserIds()));
    }

    /**
     * Admin removes a student from an exam (only before the exam is ongoing
     * and before a session was started).
     */
    @DeleteMapping("/{examId}/enrollments/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Unenroll a student from an exam (Admin only)")
    public ResponseEntity<Void> unenrollStudent(
            @PathVariable UUID examId,
            @PathVariable UUID userId) {
        enrollmentService.adminUnenroll(examId, userId);
        return ResponseEntity.noContent().build();
    }

    /** List all enrollments for an exam (paginated). */
    @GetMapping("/{examId}/enrollments")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "List enrolled students for an exam (Admin/Proctor)")
    public ResponseEntity<Page<EnrollmentService.EnrollmentDto>> getEnrollments(
            @PathVariable UUID examId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        examProctorService.requireProctorScopeForExam(examId); // proctor must be assigned
        Pageable pageable = PageRequest.of(page, size, Sort.by("enrolledAt").descending());
        return ResponseEntity.ok(enrollmentService.getEnrollments(examId, pageable));
    }

    @Data
    static class EnrollStudentRequest {
        private UUID userId;
    }
}
