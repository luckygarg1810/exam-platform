package com.gbu.examplatform.modules.enrollment;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@Tag(name = "Enrollment", description = "Student exam enrollment")
public class EnrollmentController {

    private final EnrollmentService enrollmentService;

    @PostMapping("/{examId}/enroll")
    @PreAuthorize("hasRole('STUDENT')")
    @Operation(summary = "Enroll student in exam")
    public ResponseEntity<EnrollmentService.EnrollmentDto> enroll(@PathVariable UUID examId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(enrollmentService.enroll(examId));
    }

    @GetMapping("/{examId}/enrollments")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "List enrolled students (Admin/Proctor)")
    public ResponseEntity<Page<EnrollmentService.EnrollmentDto>> getEnrollments(
            @PathVariable UUID examId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("enrolledAt").descending());
        return ResponseEntity.ok(enrollmentService.getEnrollments(examId, pageable));
    }
}
