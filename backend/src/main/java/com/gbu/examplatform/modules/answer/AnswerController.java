package com.gbu.examplatform.modules.answer;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions/{sessionId}/answers")
@RequiredArgsConstructor
@Tag(name = "Answers", description = "Exam answer submission")
public class AnswerController {

    private final AnswerService answerService;

    @PostMapping
    @PreAuthorize("hasRole('STUDENT')")
    @Operation(summary = "Save or update an answer for a question")
    public ResponseEntity<AnswerService.AnswerDto> saveAnswer(
            @PathVariable UUID sessionId,
            @RequestBody AnswerService.SaveAnswerRequest request) {
        return ResponseEntity.ok(answerService.saveAnswer(sessionId, request));
    }

    @GetMapping
    @Operation(summary = "Get all submitted answers for the session")
    public ResponseEntity<List<AnswerService.AnswerDto>> getAnswers(@PathVariable UUID sessionId) {
        return ResponseEntity.ok(answerService.getAnswers(sessionId));
    }
}
