package com.gbu.examplatform.modules.question;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuestionRepository extends JpaRepository<Question, UUID> {

    Page<Question> findByExamId(UUID examId, Pageable pageable);

    List<Question> findByExamIdOrderByOrderIndexAsc(UUID examId);

    @Query("SELECT q.id FROM Question q WHERE q.exam.id = :examId ORDER BY q.orderIndex")
    List<UUID> findQuestionIdsByExamId(@Param("examId") UUID examId);

    long countByExamId(UUID examId);

    void deleteByExamId(UUID examId);
}
