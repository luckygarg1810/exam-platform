package com.gbu.examplatform.modules.proctoring;

import com.gbu.examplatform.modules.session.ExamSessionService;
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

    @GetMapping("/sessions/{sessionId}/events")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Get proctoring events for a session")
    public ResponseEntity<Page<ProctoringEvent>> getEvents(
            @PathVariable UUID sessionId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(proctoringService.getSessionEvents(sessionId, pageable));
    }

    @GetMapping("/sessions/{sessionId}/summary")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Get violation summary for a session")
    public ResponseEntity<ViolationSummary> getSummary(@PathVariable UUID sessionId) {
        return ResponseEntity.ok(proctoringService.getSessionSummary(sessionId));
    }

    @PostMapping("/sessions/{sessionId}/flag")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Manually flag a proctoring violation")
    public ResponseEntity<ProctoringEvent> addFlag(
            @PathVariable UUID sessionId,
            @RequestBody FlagRequest request) {
        return ResponseEntity
                .ok(proctoringService.addManualFlag(sessionId, request.getEventType(), request.getDescription()));
    }

    @PostMapping("/sessions/{sessionId}/notes")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Add proctor notes to session")
    public ResponseEntity<Map<String, String>> addNotes(
            @PathVariable UUID sessionId,
            @RequestBody Map<String, String> body) {
        proctoringService.addProctorNotes(sessionId, body.get("notes"));
        return ResponseEntity.ok(Map.of("message", "Notes saved"));
    }

    @PostMapping("/sessions/{sessionId}/suspend")
    @PreAuthorize("hasAnyRole('ADMIN','PROCTOR')")
    @Operation(summary = "Manually suspend an exam session")
    public ResponseEntity<ExamSessionService.SessionDto> suspend(
            @PathVariable UUID sessionId,
            @RequestBody Map<String, String> body) {
        sessionService.suspendSession(sessionId, body.getOrDefault("reason", "Manually suspended by proctor"));
        return ResponseEntity.ok(sessionService.getSession(sessionId));
    }

    @Data
    public static class FlagRequest {
        private String eventType;
        private String description;
    }
}
