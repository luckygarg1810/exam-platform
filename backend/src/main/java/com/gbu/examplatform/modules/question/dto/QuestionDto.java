package com.gbu.examplatform.modules.question.dto;

import com.gbu.examplatform.modules.question.Question;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class QuestionDto {
    private UUID id;
    private UUID examId;
    private String text;
    private Question.QuestionType type;
    private List<Question.McqOption> options;
    private String correctAnswer; // null for students during exam
    private Integer marks;
    private Double negativeMarks;
    private Integer orderIndex;
}
