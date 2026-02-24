package com.gbu.examplatform.modules.report;

import com.gbu.examplatform.exception.UnauthorizedAccessException;
import com.gbu.examplatform.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@Tag(name = "Reports", description = "Exam results, CSV export, and session reports")
public class ReportController {

    private final ReportService reportService;
    private final SecurityUtils securityUtils;

    @GetMapping("/exams/{examId}/results")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Get all student results for an exam (paginated)")
    public ResponseEntity<Page<ReportService.SessionResultDto>> getExamResults(
            @PathVariable UUID examId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("submittedAt").descending());
        return ResponseEntity.ok(reportService.getExamResults(examId, pageable));
    }

    @GetMapping("/exams/{examId}/export")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Download CSV of all exam results")
    public ResponseEntity<byte[]> exportExamResults(@PathVariable UUID examId) {
        String csv = reportService.exportExamResultsCsv(examId);
        byte[] bytes = csv.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"exam-" + examId + "-results.csv\"")
                .contentType(MediaType.valueOf("text/csv; charset=UTF-8"))
                .contentLength(bytes.length)
                .body(bytes);
    }

    @GetMapping("/sessions/{sessionId}/full")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Full session report: score + answers + violation timeline")
    public ResponseEntity<ReportService.FullSessionReportDto> getFullReport(
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(reportService.getFullSessionReport(sessionId));
    }

    @GetMapping("/students/{userId}/history")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR','STUDENT')")
    @Operation(summary = "Exam history for a student. Students can only view their own history.")
    public ResponseEntity<List<ReportService.SessionResultDto>> getStudentHistory(
            @PathVariable UUID userId) {
        // Students may only access their own history; admins and proctors can access
        // any student's
        if (securityUtils.isStudent() && !securityUtils.getCurrentUserId().equals(userId)) {
            throw new UnauthorizedAccessException("You can only view your own exam history");
        }
        return ResponseEntity.ok(reportService.getStudentHistory(userId));
    }
}
