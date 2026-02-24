package com.gbu.examplatform.modules.answer;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnswerRepository extends JpaRepository<Answer, UUID> {

    List<Answer> findBySessionId(UUID sessionId);

    Optional<Answer> findBySessionIdAndQuestionId(UUID sessionId, UUID questionId);

    @Query("SELECT COUNT(a) FROM Answer a WHERE a.sessionId = :sessionId AND a.selectedAnswer IS NOT NULL")
    long countAnsweredMCQs(@Param("sessionId") UUID sessionId);
}
