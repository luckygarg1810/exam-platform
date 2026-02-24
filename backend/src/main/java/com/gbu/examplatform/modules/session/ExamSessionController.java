package com.gbu.examplatform.modules.session;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@Tag(name = "Sessions", description = "Exam session management")
public class ExamSessionController {

    private final ExamSessionService sessionService;

    @PostMapping("/start")
    @PreAuthorize("hasRole('STUDENT')")
    @Operation(summary = "Start exam session")
    public ResponseEntity<ExamSessionService.SessionDto> startSession(
            @RequestParam UUID examId,
            HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sessionService.startSession(examId, request));
    }

    @GetMapping("/{sessionId}")
    @Operation(summary = "Get session details")
    public ResponseEntity<ExamSessionService.SessionDto> getSession(@PathVariable UUID sessionId) {
        return ResponseEntity.ok(sessionService.getSession(sessionId));
    }

    @PostMapping("/{sessionId}/heartbeat")
    @PreAuthorize("hasRole('STUDENT')")
    @Operation(summary = "Session keep-alive heartbeat")
    public ResponseEntity<Map<String, String>> heartbeat(@PathVariable UUID sessionId) {
        sessionService.heartbeat(sessionId);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/{sessionId}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    @Operation(summary = "Submit exam session (auto-grades MCQs)")
    public ResponseEntity<ExamSessionService.SessionDto> submitSession(@PathVariable UUID sessionId) {
        return ResponseEntity.ok(sessionService.submitSession(sessionId));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('PROCTOR','ADMIN')")
    @Operation(summary = "Get all active sessions (Proctor/Admin)")
    public ResponseEntity<Page<ExamSessionService.SessionDto>> getActiveSessions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("startedAt").descending());
        return ResponseEntity.ok(sessionService.getActiveSessions(pageable));
    }

    @PostMapping("/{sessionId}/grade")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Manually grade a short-answer question for a submitted session")
    public ResponseEntity<ExamSessionService.GradeResultDto> gradeShortAnswer(
            @PathVariable UUID sessionId,
            @RequestBody GradeRequest body) {
        return ResponseEntity.ok(
                sessionService.gradeShortAnswer(sessionId, body.getQuestionId(),
                        body.getMarksAwarded(), body.getComment()));
    }

    @Data
    static class GradeRequest {
        private UUID questionId;
        private BigDecimal marksAwarded;
        private String comment;
    }
}
