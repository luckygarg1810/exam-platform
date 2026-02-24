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

    /**
     * Bulk fetch for a set of session IDs — avoids N+1 in report queries (Issue 19)
     */
    @org.springframework.data.jpa.repository.Query("SELECT vs FROM ViolationSummary vs WHERE vs.session.id IN :sessionIds")
    java.util.List<ViolationSummary> findBySessionIds(
            @org.springframework.data.repository.query.Param("sessionIds") java.util.Collection<UUID> sessionIds);
}
