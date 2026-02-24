package com.gbu.examplatform.modules.proctoring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ViolationSummaryRepository extends JpaRepository<ViolationSummary, UUID> {
    Optional<ViolationSummary> findBySessionId(UUID sessionId);
}
