package com.gbu.examplatform.modules.report;

import com.gbu.examplatform.exception.ResourceNotFoundException;
import com.gbu.examplatform.modules.answer.Answer;
import com.gbu.examplatform.modules.answer.AnswerRepository;
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
import java.util.Map;
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
        Page<ExamSession> page = sessionRepository.findByExamId(examId, pageable);
        // Bulk-fetch summaries for the whole page in a single query (Issue 19)
        Map<UUID, ViolationSummary> vsMap = buildVsMap(page.getContent());
        return page.map(s -> toResultDto(s, vsMap.get(s.getId())));
    }

    /** CSV export for an exam */
    @Transactional(readOnly = true)
    public String exportExamResultsCsv(UUID examId) {
        examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", examId.toString()));

        List<ExamSession> sessions = sessionRepository.findAllByExamId(examId);
        // Bulk-fetch summaries to avoid N+1 (Issue 19)
        Map<UUID, ViolationSummary> vsMap = buildVsMap(sessions);

        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        pw.println("Student Name,Email,University Roll,Score,Passed,Status,Violations,Risk Score,Submitted At");

        for (ExamSession s : sessions) {
            var user = s.getEnrollment().getUser();
            ViolationSummary vs = vsMap.get(s.getId());
            long totalViolations = vs == null ? 0
                    : vs.getFaceAwayCount() + vs.getGazeAwayCount() + vs.getMouthOpenCount()
                            + vs.getMultipleFaceCount() + vs.getMultiplePersonsCount()
                            + vs.getPhoneDetectedCount() + vs.getAudioViolationCount()
                            + vs.getTabSwitchCount() + vs.getFullscreenExitCount()
                            + vs.getCopyPasteCount() + vs.getSuspiciousBehaviorCount();
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
                .session(toResultDto(session, vs))
                .answers(answers.stream().map(this::toAnswerSummary).collect(Collectors.toList()))
                // Map to DTO to avoid leaking JPA entity structure / lazy-load issues (Issue
                // 18)
                .events(events.stream().map(this::toEventDto).collect(Collectors.toList()))
                .violationSummary(vs != null ? toViolationSummaryDto(vs) : null)
                .build();
    }

    // -----------------------------------------------------------------------
    // Student Exam History
    // -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<SessionResultDto> getStudentHistory(UUID userId, Pageable pageable) {
        Page<ExamSession> page = sessionRepository.findPageByUserId(userId, pageable);
        Map<UUID, ViolationSummary> vsMap = buildVsMap(page.getContent());
        return page.map(s -> toResultDto(s, vsMap.get(s.getId())));
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /**
     * Bulk-fetch violation summaries for a list of sessions in one query.
     * Returns a map keyed by session ID. (Issue 19)
     */
    private Map<UUID, ViolationSummary> buildVsMap(List<ExamSession> sessions) {
        if (sessions.isEmpty())
            return Map.of();
        List<UUID> ids = sessions.stream().map(ExamSession::getId).collect(Collectors.toList());
        return violationSummaryRepository.findBySessionIds(ids)
                .stream().collect(Collectors.toMap(vs -> vs.getSession().getId(), vs -> vs));
    }

    private SessionResultDto toResultDto(ExamSession s, ViolationSummary vs) {
        var enrollment = s.getEnrollment();
        var user = enrollment.getUser();
        var exam = enrollment.getExam();

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

    /** Maps a ProctoringEvent JPA entity to a pure-POJO DTO (Issue 18) */
    private ProctoringEventDto toEventDto(ProctoringEvent e) {
        return ProctoringEventDto.builder()
                .id(e.getId())
                .sessionId(e.getSessionId())
                .eventType(e.getEventType() != null ? e.getEventType().name() : null)
                .severity(e.getSeverity() != null ? e.getSeverity().name() : null)
                .source(e.getSource() != null ? e.getSource().name() : null)
                .confidence(e.getConfidence())
                .description(e.getDescription())
                .snapshotPath(e.getSnapshotPath())
                .metadata(e.getMetadata())
                .createdAt(e.getCreatedAt())
                .build();
    }

    /** Maps a ViolationSummary JPA entity to a pure-POJO DTO (Issue 18) */
    private ViolationSummaryDto toViolationSummaryDto(ViolationSummary vs) {
        return ViolationSummaryDto.builder()
                .id(vs.getId())
                .sessionId(vs.getSession().getId())
                .riskScore(vs.getRiskScore())
                .faceAwayCount(vs.getFaceAwayCount())
                .gazeAwayCount(vs.getGazeAwayCount())
                .mouthOpenCount(vs.getMouthOpenCount())
                .multipleFaceCount(vs.getMultipleFaceCount())
                .phoneDetectedCount(vs.getPhoneDetectedCount())
                .audioViolationCount(vs.getAudioViolationCount())
                .tabSwitchCount(vs.getTabSwitchCount())
                .fullscreenExitCount(vs.getFullscreenExitCount())
                .copyPasteCount(vs.getCopyPasteCount())
                .suspiciousBehaviorCount(vs.getSuspiciousBehaviorCount())
                .multiplePersonsCount(vs.getMultiplePersonsCount())
                .proctorFlag(vs.getProctorFlag())
                .proctorNote(vs.getProctorNote())
                .lastUpdatedAt(vs.getLastUpdatedAt())
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
        /** Pure-POJO DTO — no JPA entity exposed in API response (Issue 18) */
        private List<ProctoringEventDto> events;
        private ViolationSummaryDto violationSummary;
    }

    @Data
    @Builder
    public static class ProctoringEventDto {
        private Long id;
        private UUID sessionId;
        private String eventType;
        private String severity;
        private String source;
        private Double confidence;
        private String description;
        private String snapshotPath;
        private Map<String, Object> metadata;
        private Instant createdAt;
    }

    @Data
    @Builder
    public static class ViolationSummaryDto {
        private UUID id;
        private UUID sessionId;
        private Double riskScore;
        private Integer faceAwayCount;
        private Integer gazeAwayCount;
        private Integer mouthOpenCount;
        private Integer multipleFaceCount;
        private Integer phoneDetectedCount;
        private Integer audioViolationCount;
        private Integer tabSwitchCount;
        private Integer fullscreenExitCount;
        private Integer copyPasteCount;
        private Integer suspiciousBehaviorCount;
        private Integer multiplePersonsCount;
        private Boolean proctorFlag;
        private String proctorNote;
        private Instant lastUpdatedAt;
    }
}
