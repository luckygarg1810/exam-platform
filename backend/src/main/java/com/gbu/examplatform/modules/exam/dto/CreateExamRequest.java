package com.gbu.examplatform.modules.exam.dto;

import com.gbu.examplatform.modules.exam.Exam;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.Instant;

@Data
public class CreateExamRequest {

    @NotBlank(message = "Title is required")
    @Size(max = 200)
    private String title;

    private String description;

    @Size(max = 100)
    private String subject;

    @NotNull(message = "Start time is required")
    @Future(message = "Start time must be in the future")
    private Instant startTime;

    @NotNull(message = "End time is required")
    private Instant endTime;

    @NotNull
    @Min(5)
    @Max(480)
    private Integer durationMinutes;

    @NotNull
    @Min(1)
    private Integer totalMarks;

    @NotNull
    @Min(0)
    private Integer passingMarks;

    private Boolean shuffleQuestions = true;
    private Boolean shuffleOptions = true;
    private Boolean allowLateEntry = false;
}
