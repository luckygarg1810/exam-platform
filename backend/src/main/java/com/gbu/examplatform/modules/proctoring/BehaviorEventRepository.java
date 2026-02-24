package com.gbu.examplatform.modules.proctoring;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface BehaviorEventRepository extends JpaRepository<BehaviorEvent, Long> {

    List<BehaviorEvent> findBySessionIdOrderByTimestampDesc(UUID sessionId);

    Page<BehaviorEvent> findBySessionId(UUID sessionId, Pageable pageable);

    long countBySessionIdAndEventType(UUID sessionId, String eventType);

    long countBySessionIdAndEventTypeAndTimestampAfter(UUID sessionId, String eventType, Instant since);
}
