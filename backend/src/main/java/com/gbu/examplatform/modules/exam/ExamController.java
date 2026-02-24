package com.gbu.examplatform.modules.exam;

import com.gbu.examplatform.modules.exam.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
@Tag(name = "Exams", description = "Exam management endpoints")
public class ExamController {

    private final ExamService examService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a new exam (Admin)")
    public ResponseEntity<ExamDto> createExam(@Valid @RequestBody CreateExamRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(examService.createExam(request));
    }

    @GetMapping
    @Operation(summary = "List exams (admin sees all; student sees enrolled)")
    public ResponseEntity<Page<ExamDto>> getExams(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "startTime") String sortBy,
            @RequestParam(defaultValue = "ASC") String sortDir) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.fromString(sortDir), sortBy));
        return ResponseEntity.ok(examService.getExams(pageable));
    }

    @GetMapping("/available")
    @Operation(summary = "Browse all available exams (PUBLISHED/ONGOING)")
    public ResponseEntity<Page<ExamDto>> getAvailableExams(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("startTime").ascending());
        return ResponseEntity.ok(examService.getAvailableExams(pageable));
    }

    @GetMapping("/{examId}")
    @Operation(summary = "Get exam details")
    public ResponseEntity<ExamDto> getExam(@PathVariable UUID examId) {
        return ResponseEntity.ok(examService.getExamById(examId));
    }

    @PutMapping("/{examId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update exam (Admin, only DRAFT)")
    public ResponseEntity<ExamDto> updateExam(@PathVariable UUID examId,
            @Valid @RequestBody CreateExamRequest request) {
        return ResponseEntity.ok(examService.updateExam(examId, request));
    }

    @DeleteMapping("/{examId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Soft-delete exam (Admin)")
    public ResponseEntity<Map<String, String>> deleteExam(@PathVariable UUID examId) {
        examService.deleteExam(examId);
        return ResponseEntity.ok(Map.of("message", "Exam deleted successfully"));
    }

    @PostMapping("/{examId}/publish")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Publish exam (Admin, requires questions)")
    public ResponseEntity<ExamDto> publishExam(@PathVariable UUID examId) {
        return ResponseEntity.ok(examService.publishExam(examId));
    }
}
