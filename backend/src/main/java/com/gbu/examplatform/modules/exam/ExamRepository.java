package com.gbu.examplatform.modules.exam;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExamRepository extends JpaRepository<Exam, UUID> {

        Page<Exam> findByIsDeletedFalse(Pageable pageable);

        Page<Exam> findByStatusInAndIsDeletedFalse(List<Exam.ExamStatus> statuses, Pageable pageable);

        List<Exam> findByStatusAndStartTimeBeforeAndIsDeletedFalse(Exam.ExamStatus status, Instant time);

        List<Exam> findByStatusAndEndTimeBeforeAndIsDeletedFalse(Exam.ExamStatus status, Instant time);

        @Query("SELECT e FROM Exam e WHERE e.isDeleted = false AND e.status IN :statuses " +
                        "AND e.id IN (SELECT en.exam.id FROM ExamEnrollment en WHERE en.user.id = :userId)")
        Page<Exam> findByEnrolledUserAndStatuses(@Param("userId") UUID userId,
                        @Param("statuses") List<Exam.ExamStatus> statuses,
                        Pageable pageable);

        /** Exams assigned to a proctor (all statuses except deleted). */
        @Query("SELECT e FROM Exam e WHERE e.isDeleted = false " +
                        "AND e.id IN (SELECT ep.exam.id FROM ExamProctor ep WHERE ep.proctor.id = :proctorId)")
        Page<Exam> findByAssignedProctor(@Param("proctorId") UUID proctorId, Pageable pageable);

        @Modifying
        @Query("UPDATE Exam e SET e.status = :newStatus WHERE e.status = :oldStatus AND e.startTime < :now AND e.isDeleted = false")
        int transitionStatus(@Param("oldStatus") Exam.ExamStatus oldStatus,
                        @Param("newStatus") Exam.ExamStatus newStatus,
                        @Param("now") Instant now);

        @Query("SELECT COUNT(q) FROM Question q WHERE q.exam.id = :examId")
        long countQuestions(@Param("examId") UUID examId);

        /**
         * Sum of all question marks for an exam — used to validate against totalMarks
         * before publish (Issue 52)
         */
        @Query("SELECT COALESCE(SUM(q.marks), 0) FROM Question q WHERE q.exam.id = :examId")
        double sumQuestionMarks(@Param("examId") UUID examId);

        /** Bulk question-count fetch — avoids N+1 on exam list pages (Issue 47) */
        @Query("SELECT q.exam.id, COUNT(q) FROM Question q WHERE q.exam.id IN :examIds GROUP BY q.exam.id")
        List<Object[]> countQuestionsForExams(@Param("examIds") List<UUID> examIds);
}
