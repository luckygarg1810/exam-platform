package com.gbu.examplatform.modules.proctoring;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProctoringEventRepository extends JpaRepository<ProctoringEvent, UUID> {

    List<ProctoringEvent> findBySessionIdOrderByCreatedAtDesc(UUID sessionId);

    Page<ProctoringEvent> findBySessionId(UUID sessionId, Pageable pageable);

    long countBySessionId(UUID sessionId);

    long countBySessionIdAndSeverity(UUID sessionId, ProctoringEvent.Severity severity);

    @Query("SELECT p FROM ProctoringEvent p WHERE p.sessionId = :sessionId AND p.severity IN :severities ORDER BY p.createdAt DESC")
    List<ProctoringEvent> findHighSeverityBySession(@Param("sessionId") UUID sessionId,
            @Param("severities") List<ProctoringEvent.Severity> severities);
}
