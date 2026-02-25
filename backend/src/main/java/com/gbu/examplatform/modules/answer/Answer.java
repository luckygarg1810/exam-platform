package com.gbu.examplatform.modules.answer;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "answers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Answer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(name = "selected_answer", length = 10)
    private String selectedAnswer;

    @Column(name = "marks_awarded", precision = 4, scale = 1)
    private BigDecimal marksAwarded;

    @CreationTimestamp
    @Column(name = "saved_at")
    private Instant savedAt;
}
