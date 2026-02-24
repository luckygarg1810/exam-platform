package com.gbu.examplatform.modules.enrollment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EnrollmentRepository extends JpaRepository<ExamEnrollment, UUID> {

    Optional<ExamEnrollment> findByExamIdAndUserId(UUID examId, UUID userId);

    boolean existsByExamIdAndUserId(UUID examId, UUID userId);

    Page<ExamEnrollment> findByExamId(UUID examId, Pageable pageable);

    Page<ExamEnrollment> findByUserId(UUID userId, Pageable pageable);

    @Query("SELECT en FROM ExamEnrollment en WHERE en.exam.id = :examId ORDER BY en.enrolledAt DESC")
    Page<ExamEnrollment> findEnrollmentsByExam(@Param("examId") UUID examId, Pageable pageable);
}
