package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import com.gbu.examplatform.modules.session.ExamSessionService;
import com.gbu.examplatform.exception.ResourceNotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/proctoring")
@RequiredArgsConstructor
@Tag(name = "Proctoring", description = "Proctoring event management and reporting")
public class ProctoringController {

    private final ProctoringService proctoringService;
    private final ExamSessionService sessionService;
    private final BehaviorEventRepository behaviorEventRepository;
    private final ExamProctorService examProctorService;
    private final ExamSessionRepository examSessionRepository;

    // ── scope guard ──────────────────────────────────────────────────────────────

    /** Admins may act on any session; proctors only on their assigned exams. */
    private void requireScope(UUID sessionId) {
        ExamSession session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId.toString()));
        examProctorService.requireProctorScopeForExam(
                session.getEnrollment().getExam().getId());
    }

    // ── endpoints ────────────────────────────────────────────────────────────────

    @GetMapping("/sessions/{sessionId}/events")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Get proctoring events for a session (paginated)")
    public ResponseEntity<Page<ProctoringEvent>> getEvents(
            @PathVariable UUID sessionId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        requireScope(sessionId);
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(proctoringService.getSessionEvents(sessionId, pageable));
    }

    @GetMapping("/sessions/{sessionId}/summary")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Get violation summary for a session")
    public ResponseEntity<ViolationSummary> getSummary(@PathVariable UUID sessionId) {
        requireScope(sessionId);
        return ResponseEntity.ok(proctoringService.getSessionSummary(sessionId));
    }

    @PostMapping("/sessions/{sessionId}/flag")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Manually flag a proctoring violation")
    public ResponseEntity<ProctoringEvent> addFlag(
            @PathVariable UUID sessionId,
            @RequestBody FlagRequest request) {
        requireScope(sessionId);
        return ResponseEntity.ok(
                proctoringService.addManualFlag(sessionId, request.getEventType(), request.getDescription()));
    }

    @PostMapping("/sessions/{sessionId}/clear")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Clear proctor flag (false positive)")
    public ResponseEntity<Map<String, String>> clearFlag(@PathVariable UUID sessionId) {
        requireScope(sessionId);
        proctoringService.clearProctorFlag(sessionId);
        return ResponseEntity.ok(Map.of("message", "Flag cleared"));
    }

    @PostMapping("/sessions/{sessionId}/notes")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Add proctor notes to session")
    public ResponseEntity<Map<String, String>> addNote(
            @PathVariable UUID sessionId,
            @RequestBody Map<String, String> body) {
        requireScope(sessionId);
        proctoringService.addProctorNote(sessionId, body.get("note"));
        return ResponseEntity.ok(Map.of("message", "Note saved"));
    }

    @PostMapping("/sessions/{sessionId}/suspend")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Manually suspend an exam session")
    public ResponseEntity<ExamSessionService.SessionDto> suspend(
            @PathVariable UUID sessionId,
            @RequestBody Map<String, String> body) {
        requireScope(sessionId);
        sessionService.suspendSession(sessionId,
                body.getOrDefault("reason", "Manually suspended by proctor"));
        return ResponseEntity.ok(sessionService.getSession(sessionId));
    }

    @GetMapping("/sessions/{sessionId}/behavior-events")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Paginated browser-behavior event feed for a session")
    public ResponseEntity<Page<BehaviorEvent>> getBehaviorEvents(
            @PathVariable UUID sessionId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        requireScope(sessionId);
        Pageable pageable = PageRequest.of(page, size, Sort.by("timestamp").descending());
        return ResponseEntity.ok(behaviorEventRepository.findBySessionId(sessionId, pageable));
    }

    @Data
    public static class FlagRequest {
        private String eventType;
        private String description;
    }
}
