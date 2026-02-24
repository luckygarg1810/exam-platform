package com.gbu.examplatform.modules.proctoring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ViolationSummaryRepository extends JpaRepository<ViolationSummary, UUID> {

    /**
     * Spring Data JPA path navigation: session.id
     * Matches the OneToOne join column on ViolationSummary.session
     */
    Optional<ViolationSummary> findBySession_Id(UUID sessionId);
}
