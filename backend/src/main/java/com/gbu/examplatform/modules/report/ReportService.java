package com.gbu.examplatform.modules.report;

import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.answer.Answer;
import com.gbu.examplatform.modules.answer.AnswerRepository;
import com.gbu.examplatform.modules.exam.Exam;
import com.gbu.examplatform.modules.exam.ExamRepository;
import com.gbu.examplatform.modules.proctoring.ProctoringEvent;
import com.gbu.examplatform.modules.proctoring.ProctoringEventRepository;
import com.gbu.examplatform.modules.proctoring.ViolationSummary;
import com.gbu.examplatform.modules.proctoring.ViolationSummaryRepository;
import com.gbu.examplatform.modules.session.ExamSession;
import com.gbu.examplatform.modules.session.ExamSessionRepository;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ExamRepository examRepository;
    private final ExamSessionRepository sessionRepository;
    private final AnswerRepository answerRepository;
    private final ProctoringEventRepository proctoringEventRepository;
    private final ViolationSummaryRepository violationSummaryRepository;

    // -----------------------------------------------------------------------
    // Exam Results
    // -----------------------------------------------------------------------

    /** All session results for an exam (for admin overview) */
    @Transactional(readOnly = true)
    public Page<SessionResultDto> getExamResults(UUID examId, Pageable pageable) {
        examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", examId.toString()));
        return sessionRepository.findByExamId(examId, pageable).map(this::toResultDto);
    }

    /** CSV export for an exam */
    @Transactional(readOnly = true)
    public String exportExamResultsCsv(UUID examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", examId.toString()));

        List<ExamSession> sessions = sessionRepository.findAllByExamId(examId);

        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        pw.println("Student Name,Email,University Roll,Score,Passed,Status,Violations,Risk Score,Submitted At");

        for (ExamSession s : sessions) {
            var user = s.getEnrollment().getUser();
            ViolationSummary vs = violationSummaryRepository.findBySession_Id(s.getId()).orElse(null);
            long totalViolations = vs == null ? 0
                    : vs.getFaceAwayCount() + vs.getMultipleFaceCount() + vs.getPhoneDetectedCount()
                            + vs.getAudioViolationCount() + vs.getTabSwitchCount()
                            + vs.getFullscreenExitCount() + vs.getCopyPasteCount();
            double riskScore = vs == null ? 0.0 : vs.getRiskScore();

            pw.printf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%d\",\"%.4f\",\"%s\"%n",
                    escape(user.getName()),
                    escape(user.getEmail()),
                    escape(user.getUniversityRoll()),
                    s.getScore() != null ? s.getScore().toPlainString() : "",
                    s.getIsPassed() != null ? (s.getIsPassed() ? "Yes" : "No") : "",
                    s.getEnrollment().getStatus().name(),
                    totalViolations,
                    riskScore,
                    s.getSubmittedAt() != null ? s.getSubmittedAt().toString() : "");
        }
        pw.flush();
        return sw.toString();
    }

    // -----------------------------------------------------------------------
    // Full Session Report
    // -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public FullSessionReportDto getFullSessionReport(UUID sessionId) {
        ExamSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId.toString()));

        List<Answer> answers = answerRepository.findBySessionId(sessionId);
        List<ProctoringEvent> events = proctoringEventRepository
                .findBySessionIdOrderByCreatedAtDesc(sessionId);
        ViolationSummary vs = violationSummaryRepository.findBySession_Id(sessionId).orElse(null);

        return FullSessionReportDto.builder()
                .session(toResultDto(session))
                .answers(answers.stream().map(this::toAnswerSummary).collect(Collectors.toList()))
                .events(events)
                .violationSummary(vs)
                .build();
    }

    // -----------------------------------------------------------------------
    // Student Exam History
    // -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<SessionResultDto> getStudentHistory(UUID userId) {
        return sessionRepository.findByUserId(userId)
                .stream()
                .map(this::toResultDto)
                .collect(Collectors.toList());
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    private SessionResultDto toResultDto(ExamSession s) {
        var enrollment = s.getEnrollment();
        var user = enrollment.getUser();
        var exam = enrollment.getExam();
        ViolationSummary vs = violationSummaryRepository.findBySession_Id(s.getId()).orElse(null);

        return SessionResultDto.builder()
                .sessionId(s.getId())
                .examId(exam.getId())
                .examTitle(exam.getTitle())
                .userId(user.getId())
                .studentName(user.getName())
                .studentEmail(user.getEmail())
                .universityRoll(user.getUniversityRoll())
                .score(s.getScore())
                .totalMarks(exam.getTotalMarks())
                .isPassed(s.getIsPassed())
                .enrollmentStatus(enrollment.getStatus().name())
                .isSuspended(s.getIsSuspended())
                .riskScore(vs != null ? vs.getRiskScore() : 0.0)
                .proctorFlagged(vs != null && Boolean.TRUE.equals(vs.getProctorFlag()))
                .startedAt(s.getStartedAt())
                .submittedAt(s.getSubmittedAt())
                .build();
    }

    private AnswerSummaryDto toAnswerSummary(Answer a) {
        return AnswerSummaryDto.builder()
                .questionId(a.getQuestionId())
                .selectedAnswer(a.getSelectedAnswer())
                .textAnswer(a.getTextAnswer())
                .marksAwarded(a.getMarksAwarded())
                .build();
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("\"", "\"\"");
    }

    // -----------------------------------------------------------------------
    // DTOs
    // -----------------------------------------------------------------------

    @Data
    @Builder
    public static class SessionResultDto {
        private UUID sessionId;
        private UUID examId;
        private String examTitle;
        private UUID userId;
        private String studentName;
        private String studentEmail;
        private String universityRoll;
        private BigDecimal score;
        private Integer totalMarks;
        private Boolean isPassed;
        private String enrollmentStatus;
        private Boolean isSuspended;
        private Double riskScore;
        private Boolean proctorFlagged;
        private Instant startedAt;
        private Instant submittedAt;
    }

    @Data
    @Builder
    public static class AnswerSummaryDto {
        private UUID questionId;
        private String selectedAnswer;
        private String textAnswer;
        private BigDecimal marksAwarded;
    }

    @Data
    @Builder
    public static class FullSessionReportDto {
        private SessionResultDto session;
        private List<AnswerSummaryDto> answers;
        private List<ProctoringEvent> events;
        private ViolationSummary violationSummary;
    }
}
