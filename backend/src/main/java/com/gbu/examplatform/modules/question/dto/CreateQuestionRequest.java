package com.gbu.examplatform.modules.question.dto;

import com.gbu.examplatform.modules.question.Question;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class CreateQuestionRequest {

    @NotBlank(message = "Question text is required")
    private String text;

    @NotNull(message = "Question type is required")
    private Question.QuestionType type;

    // For MCQ: list of options
    private List<Question.McqOption> options;

    // For MCQ: the correct option key (A, B, C, D)
    private String correctAnswer;

    @NotNull
    @Min(1)
    @Max(100)
    private Integer marks;

    @DecimalMin("0")
    @DecimalMax("10")
    private Double negativeMarks = 0.0;

    private Integer orderIndex;
}
