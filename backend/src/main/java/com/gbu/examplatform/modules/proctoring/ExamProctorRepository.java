package com.gbu.examplatform.modules.proctoring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExamProctorRepository extends JpaRepository<ExamProctor, ExamProctor.ExamProctorId> {

    List<ExamProctor> findByExamId(UUID examId);

    List<ExamProctor> findByProctorId(UUID proctorId);

    boolean existsByExamIdAndProctorId(UUID examId, UUID proctorId);

    void deleteByExamIdAndProctorId(UUID examId, UUID proctorId);

    /**
     * Returns true if the given proctor is already assigned to another exam
     * whose time window overlaps [startTime, endTime).
     * Used to enforce the "no overlapping exams per proctor" rule.
     */
    @Query("""
            SELECT COUNT(ep) > 0
            FROM ExamProctor ep
            JOIN ep.exam e
            WHERE ep.proctor.id = :proctorId
              AND e.id          <> :excludeExamId
              AND e.isDeleted   = false
              AND e.startTime   < :endTime
              AND e.endTime     > :startTime
            """)
    boolean existsOverlappingAssignment(
            @Param("proctorId") UUID proctorId,
            @Param("excludeExamId") UUID excludeExamId,
            @Param("startTime") Instant startTime,
            @Param("endTime") Instant endTime);

    /** All exam IDs where a given proctor is assigned. */
    @Query("SELECT ep.exam.id FROM ExamProctor ep WHERE ep.proctor.id = :proctorId")
    List<UUID> findExamIdsByProctorId(@Param("proctorId") UUID proctorId);

    /** Check if a user is an assigned proctor for a specific exam. */
    @Query("SELECT COUNT(ep) > 0 FROM ExamProctor ep WHERE ep.exam.id = :examId AND ep.proctor.id = :proctorId")
    boolean isProctorForExam(@Param("examId") UUID examId, @Param("proctorId") UUID proctorId);
}
