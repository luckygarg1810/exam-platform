package com.gbu.examplatform.modules.exam.dto;

import com.gbu.examplatform.modules.exam.Exam;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class ExamDto {
    private UUID id;
    private String title;
    private String description;
    private String subject;
    private String createdByName;
    private Instant startTime;
    private Instant endTime;
    private Integer durationMinutes;
    private Integer totalMarks;
    private Integer passingMarks;
    private Boolean shuffleQuestions;
    private Boolean shuffleOptions;
    private Exam.ExamStatus status;
    private Boolean allowLateEntry;
    private Instant createdAt;
    private Long questionCount;
}
