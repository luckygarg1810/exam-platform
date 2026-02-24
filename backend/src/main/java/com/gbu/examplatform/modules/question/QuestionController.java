package com.gbu.examplatform.modules.question;

import com.gbu.examplatform.modules.question.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/exams/{examId}/questions")
@RequiredArgsConstructor
@Tag(name = "Questions", description = "Exam question management")
public class QuestionController {

    private final QuestionService questionService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Add question to exam (Admin)")
    public ResponseEntity<QuestionDto> createQuestion(
            @PathVariable UUID examId,
            @Valid @RequestBody CreateQuestionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(questionService.createQuestion(examId, request));
    }

    @GetMapping
    @Operation(summary = "List questions for exam (admin sees answers; student doesn't)")
    public ResponseEntity<Page<QuestionDto>> getQuestions(
            @PathVariable UUID examId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("orderIndex").ascending());
        return ResponseEntity.ok(questionService.getQuestions(examId, pageable));
    }

    @GetMapping("/shuffled")
    @PreAuthorize("hasRole('STUDENT')")
    @Operation(summary = "Get shuffled questions during exam (student only, cached order)")
    public ResponseEntity<List<QuestionDto>> getShuffledQuestions(@PathVariable UUID examId) {
        return ResponseEntity.ok(questionService.getShuffledQuestions(examId));
    }

    @PutMapping("/{questionId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update question (Admin)")
    public ResponseEntity<QuestionDto> updateQuestion(
            @PathVariable UUID examId,
            @PathVariable UUID questionId,
            @Valid @RequestBody CreateQuestionRequest request) {
        return ResponseEntity.ok(questionService.updateQuestion(examId, questionId, request));
    }

    @DeleteMapping("/{questionId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete question (Admin)")
    public ResponseEntity<Map<String, String>> deleteQuestion(
            @PathVariable UUID examId,
            @PathVariable UUID questionId) {
        questionService.deleteQuestion(examId, questionId);
        return ResponseEntity.ok(Map.of("message", "Question deleted successfully"));
    }
}
