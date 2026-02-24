package com.gbu.examplatform.modules.session;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamSessionRepository extends JpaRepository<ExamSession, UUID> {

        // Find active session for a user in a specific exam
        @Query("SELECT s FROM ExamSession s WHERE s.enrollment.user.id = :userId " +
                        "AND s.enrollment.exam.id = :examId AND s.submittedAt IS NULL AND s.isSuspended = false")
        Optional<ExamSession> findActiveSessionByUserAndExam(@Param("userId") UUID userId,
                        @Param("examId") UUID examId);

        // Any active session for a user (to prevent concurrent sessions)
        @Query("SELECT s FROM ExamSession s WHERE s.enrollment.user.id = :userId " +
                        "AND s.submittedAt IS NULL AND s.isSuspended = false")
        List<ExamSession> findActiveSessionsByUser(@Param("userId") UUID userId);

        // Any session (active or suspended) for a user in a specific exam
        @Query("SELECT s FROM ExamSession s WHERE s.enrollment.user.id = :userId " +
                        "AND s.enrollment.exam.id = :examId AND s.submittedAt IS NULL")
        Optional<ExamSession> findAnyOpenSessionByUserAndExam(@Param("userId") UUID userId,
                        @Param("examId") UUID examId);

        Optional<ExamSession> findByEnrollmentId(UUID enrollmentId);

        // Find sessions with stale heartbeat for auto-submission
        @Query("SELECT s FROM ExamSession s WHERE s.submittedAt IS NULL " +
                        "AND s.isSuspended = false AND s.lastHeartbeatAt < :cutoff")
        List<ExamSession> findStaleSessions(@Param("cutoff") Instant cutoff);

        // Active sessions with recent heartbeat (for proctor)
        @Query("SELECT s FROM ExamSession s WHERE s.submittedAt IS NULL " +
                        "AND s.isSuspended = false AND s.lastHeartbeatAt > :recentCutoff")
        Page<ExamSession> findActiveSessions(@Param("recentCutoff") Instant recentCutoff, Pageable pageable);

        // All active sessions for a specific exam (used for end-time auto-submit)
        @Query("SELECT s FROM ExamSession s WHERE s.enrollment.exam.id = :examId " +
                        "AND s.submittedAt IS NULL AND s.isSuspended = false")
        List<ExamSession> findActiveSessionsByExamId(@Param("examId") UUID examId);

        // All sessions for an exam (for reports)
        @Query("SELECT s FROM ExamSession s WHERE s.enrollment.exam.id = :examId")
        Page<ExamSession> findByExamId(@Param("examId") UUID examId, Pageable pageable);

        // All sessions for an exam without pagination (CSV export)
        @Query("SELECT s FROM ExamSession s WHERE s.enrollment.exam.id = :examId")
        List<ExamSession> findAllByExamId(@Param("examId") UUID examId);

        // All sessions for a specific student (history)
        @Query("SELECT s FROM ExamSession s WHERE s.enrollment.user.id = :userId ORDER BY s.startedAt DESC")
        List<ExamSession> findByUserId(@Param("userId") UUID userId);

        // Ownership check: used by WebSocket handlers to verify a student owns a
        // session
        @Query("SELECT COUNT(s) FROM ExamSession s WHERE s.id = :id AND s.enrollment.user.id = :userId")
        long countByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);
}
