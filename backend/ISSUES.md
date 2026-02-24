# Backend Issues Audit

**Date:** February 24, 2026  
**Status:** 54 issues identified across Security, Functional Bugs, Architecture, Missing Features, Infrastructure, and Cross-Service categories.

---

## Security Issues

### 1. Self-Registration as Any Role (Critical)
**File:** `modules/auth/dto/RegisterRequest.java`, `modules/auth/AuthService.java`  
`RegisterRequest.role` is a free enum field with no server-side restriction. Any anonymous user can `POST /api/auth/register` with `"role": "ADMIN"` or `"role": "PROCTOR"` and immediately gain elevated privileges. The `register()` method blindly uses `request.getRole()` without whitelisting `STUDENT`-only self-registration.

### 2. Students Can Read Other Students' Exam History (High)
**File:** `modules/report/ReportController.java`  
`GET /api/reports/students/{userId}/history` is `@PreAuthorize("hasAnyRole('ADMIN','STUDENT')")` but performs no ownership check inside `ReportService.getStudentHistory()`. Student A can pass any other student's UUID and read their full exam history, scores, and session data.

### 3. WebSocket Subscriptions Not Authorized (High)
**File:** `config/WebSocketChannelInterceptor.java`, `config/WebSocketConfig.java`  
The interceptor only validates the JWT on `STOMP CONNECT` frames. There is no validation or ownership check on `SUBSCRIBE` frames. Any authenticated user who knows a session UUID can subscribe to `/queue/exam/{anySessionId}/warning` and `/queue/exam/{anySessionId}/suspend`, receiving another student's real-time proctoring notifications.

### 4. Refresh Token Never Rotated (High)
**File:** `modules/auth/AuthService.java` — `refreshToken()`  
Calling `POST /api/auth/refresh` issues a new access token but returns and stores the same refresh token. The old token is never deleted or replaced. If a refresh token is stolen, it remains valid for the full 7-day TTL with no ability to detect or invalidate a parallel session.

### 5. Refresh Token Accepted as Bearer Token on REST Endpoints (High)
**File:** `security/JwtAuthenticationFilter.java`  
`validateToken()` only checks signature and expiry — not the `type` claim. A REFRESH token (which is a valid signed JWT) can be passed as the `Authorization: Bearer` header on any REST endpoint and will be accepted. An attacker who obtains a refresh token can use it directly to authenticate API calls.

### 6. Overly Broad WebSocket CORS (Low)
**File:** `config/WebSocketConfig.java`  
`setAllowedOriginPatterns("http://localhost:*")` allows any port on localhost. This is a development convenience but is not restricted per environment, meaning it applies in production as-is.

---

## Functional Bugs

### 7. Suspended Student Can Start a New Session (High)
**File:** `modules/session/ExamSessionService.java` — `startSession()`  
`findActiveSessionsByUser()` queries `WHERE isSuspended = false`. When a session is suspended it is excluded from this list. As a result, a suspended student has no active session and passes the "already active" check, allowing them to start a completely fresh session for the same exam.

### 8. Suspended Session Can Be Manually Submitted (Medium)
**File:** `modules/session/ExamSessionService.java` — `submitSession()`  
`submitSession()` only checks `session.getSubmittedAt() != null` to block re-submission. It does not check `isSuspended`. A student with a suspended session can call `POST /api/sessions/{id}/submit`, trigger MCQ auto-grading, and have their session marked as `COMPLETED` with a score.

### 9. Exam Update Doesn't Re-Validate Start/End Time Relationship (Medium)
**File:** `modules/exam/ExamService.java` — `updateExam()`  
`createExam()` validates `endTime > startTime`, but `updateExam()` applies partial updates without re-running this check. Patching only `startTime` to a value after the current `endTime` silently produces an invalid exam where the exam would end before it starts.

### 10. Questions Updatable While Exam Is PUBLISHED or ONGOING (High)
**File:** `modules/question/QuestionService.java` — `updateQuestion()`, `deleteQuestion()`  
No status guard is applied when updating or deleting questions. An admin can change a `correctAnswer` mid-exam. Students who answered before the change will have their existing `Answer.selectedAnswer` compared against the new correct answer during `calculateScore()`, silently corrupting scores.

### 11. WebSocket Behavior Event Timestamp Cast Bug (Medium)
**File:** `modules/proctoring/ExamWebSocketController.java` — `handleBehaviorEvent()`  
The code does `((Number) payload.getOrDefault("timestamp", System.currentTimeMillis())).longValue()`. If a STOMP client sends `timestamp` as a JSON string (common in JavaScript clients with `JSON.stringify`), this throws `ClassCastException`. The exception propagates out of the `@Transactional` handler, causing the behavior event save and RabbitMQ publish to both fail, and Spring rolls back the transaction.

### 12. Race Condition in Shuffled Question Cache (Medium)
**File:** `modules/question/QuestionService.java` — `getShuffledQuestions()`  
Two concurrent requests at session start both miss the Redis cache (empty). Both compute different random shuffle orders and overwrite each other. The second write wins, and the first question order (already rendered in the student's browser) no longer matches what Redis stores, causing potential question-answer mismatch if the client uses index-based references.

### 13. Message Loss with AUTO Ack and No Dead Letter Queue (High)
**File:** `config/RabbitMQConfig.java`, `modules/proctoring/ProctoringResultConsumer.java`  
`acknowledge-mode: auto` acknowledges messages immediately upon delivery, before the listener method completes. If `handleProctoringResult` throws any exception (DB connection error, JSON cast, entity not found), the message is already acknowledged and permanently lost. No Dead Letter Queue (DLQ) or Dead Letter Exchange (DLX) is configured in `RabbitMQConfig` to capture failed messages for retry or inspection.

### 14. Transaction Rollback-Only Trap in Schedulers (High)
**File:** `scheduler/ExamScheduler.java`, `scheduler/StaleSessionScheduler.java`  
Both schedulers are `@Transactional` and call `sessionService.submitSession()` (also `@Transactional(REQUIRED)`) inside a `try/catch` loop. If `submitSession()` causes a database-level exception (e.g., constraint violation), Spring marks the outermost shared transaction as `rollback-only`. Even though the exception is caught, when the outer transaction commits it throws `TransactionSystemException: Transaction silently rolled back`, rolling back all exam status transitions and all successfully processed session submissions in the entire batch.

### 35. COPY_PASTE Event Type Inconsistency (Medium)
**File:** `modules/proctoring/ExamWebSocketController.java` — `applyQuickRules()`, `modules/proctoring/ProctoringResultConsumer.java` — `updateCounters()`  
`applyQuickRules` fires on browser events named `COPY_ATTEMPT` / `PASTE_ATTEMPT`, but `ProctoringEvent.EventType` and `updateCounters()` in the consumer both use the name `COPY_PASTE`. The browser sends `COPY_ATTEMPT`, which triggers a student warning correctly, but the `ViolationSummary.copyPasteCount` counter is only incremented when the AI sends `COPY_PASTE`. Copy/paste events from the browser will never increment the counter — they are warned about in real-time but not reflected in reports or risk scoring.

*(Listed here to keep numbering consistent; originally issue #36 in the audit.)*

---

## Architecture / Design Issues

### 15. WebSocket Heartbeat Bypasses Service Layer (Low)
**File:** `modules/proctoring/ExamWebSocketController.java` — `handleHeartbeat()`  
`handleHeartbeat()` calls `sessionRepository.save(session)` and updates Redis directly, duplicating all the logic in `ExamSessionService.heartbeat()`. The REST `POST /sessions/{id}/heartbeat` and the WebSocket `/app/exam/{id}/heartbeat` are now two separate code paths that must be manually kept in sync if the heartbeat logic changes.

### 16. WebSocket Frame/Audio Handlers Don't Verify Session Ownership (High)
**File:** `modules/proctoring/ExamWebSocketController.java` — `validateSession()`  
`validateSession()` only checks if the session is open (not submitted, not suspended). It does not compare `session.getEnrollment().getUser().getId()` against the currently authenticated WebSocket principal. Any authenticated student who discovers another student's session UUID can send camera frames and audio blobs for that session, polluting its proctoring data.

### 17. Unused Dependency in ProctoringController (Low)
**File:** `modules/proctoring/ProctoringController.java`  
`NotificationService` is injected via `@RequiredArgsConstructor` but is never used anywhere in the controller. Dead code that creates a misleading dependency.

### 18. Raw JPA Entity Exposed in FullSessionReportDto (Medium)
**File:** `modules/report/ReportService.java` — `FullSessionReportDto`  
`List<ProctoringEvent> events` is a JPA entity collection used directly inside a DTO returned by the API. This leaks internal entity structure and JPA metadata, can trigger `LazyInitializationException` if the Jackson serializer touches uninitialized lazy associations outside the transaction, and makes the API surface tightly coupled to the database schema.

### 19. N+1 Query Problem in ReportService (Medium)
**File:** `modules/report/ReportService.java` — `toResultDto()`, `exportExamResultsCsv()`  
`toResultDto(ExamSession)` calls `violationSummaryRepository.findBySession_Id(s.getId())` for every session individually. `getExamResults()` (paginated) and `exportExamResultsCsv()` (all sessions, no pagination) both suffer this pattern. For an exam with 500 students, this produces 501 sequential SQL queries (1 for sessions + 500 individual summary lookups).

### 20. CleanupScheduler Mixes Abstraction Levels (Low)
**File:** `scheduler/CleanupScheduler.java`  
The scheduler injects both `MinioClient` (raw SDK client) and `StorageService` (the abstraction layer), calling `minioClient.listObjects()` directly while using `storageService.deleteFile()` for deletion. The abstraction is bypassed for listing, creating an inconsistency. Any future changes to how objects are listed in `StorageService` won't affect the cleanup scheduler.

### 21. ExamScheduler Uses a Single Transaction for Batch Submissions (High)
**File:** `scheduler/ExamScheduler.java` — `transitionOngoingToCompleted()`  
The exam status transition and all session submissions are in a single `@Transactional` method. This is the root cause of issue #14. Even independently, a failure in any single session's submission (note: also calls emailService which can throw) rolls back the entire batch including already-completed sessions and the exam status change itself.

---

## Missing Features / Incomplete Flows

### 22. Identity Verification Is a Dead Field (Medium)
**File:** `modules/session/ExamSession.java`, `modules/user/User.java`  
Both `ExamSession.identityVerified` and `User.idPhotoPath` exist in the DB schema and JPA entities. There is no API endpoint, no AI service call, and no logic that ever sets `identityVerified = true`. The IMPLEMENTATION_PLAN mentions phase-based face-match identity check, but the entire flow is absent.

### 23. No Manual Grading Endpoint for Short Answer Questions (Medium)
**File:** `modules/session/ExamSessionService.java` — `calculateScore()`  
`SHORT_ANSWER` questions are auto-assigned `marksAwarded = BigDecimal.ZERO` at submission time with a comment "manual review". However, no API endpoint exists for an admin/proctor to later review short-answer responses and award marks. `Answer.marksAwarded` for short answers is permanently zero.

### 24. NotificationService.sendSessionUpdate Is Dead Code (Low)
**File:** `modules/notification/NotificationService.java`  
`sendSessionUpdate(UUID sessionId, Map<String, Object> update)` is documented and implemented but never called from any service or consumer. Proctors cannot receive per-session live state pushes through this channel.

### 25. Some Violation Types Don't Increment Any Summary Counter (Medium)
**File:** `modules/proctoring/ProctoringResultConsumer.java` — `updateCounters()`  
`NOTES_DETECTED`, `IDENTITY_MISMATCH`, and `MANUAL_FLAG` all fall through to the `default` branch which does nothing. These violations are recorded in `proctoring_events` but never reflected in any `violations_summary` counter. A student detected with notes or failing identity verification shows zero extra violations in the summary, does not raise the risk score, and does not appear in aggregated reports.

### 26. No Rate Limiting on WebSocket Handlers (Medium)
**File:** `modules/proctoring/ExamWebSocketController.java`  
The `/app/exam/{id}/frame`, `/app/exam/{id}/audio`, `/app/exam/{id}/event`, and `/app/exam/{id}/heartbeat` handlers have no per-session or per-user rate limiting. A malicious or buggy client can flood the DB (`behavior_events`) and RabbitMQ queues at arbitrary speed with no back-pressure or throttling.

### 27. No Student Unenrollment Endpoint (Low)
**File:** `modules/enrollment/EnrollmentController.java`  
There is a `POST /{examId}/enroll` to enroll but no corresponding endpoint to unenroll or withdraw from an exam before it starts.

### 28. Student History Returns an Unbounded List (Low)
**File:** `modules/report/ReportService.java` — `getStudentHistory()`  
`findByUserId()` returns `List<ExamSession>` with no pagination. A student who participated in many exams over time will have all history loaded into memory in a single query and serialized in one HTTP response.

### 29. No Proctor Live Behavior Event Feed (Low)
**File:** `modules/proctoring/BehaviorEventRepository.java`, `modules/proctoring/ProctoringController.java`  
Proctors can view violation alerts (broadcast) and the violation summary, but there is no endpoint or WebSocket channel to stream or query the raw `behavior_events` log for a session. Proctors cannot see the chronological timeline of browser-level events (tab switches, copy attempts, focus losses) during monitoring.

---

## Configuration / Infrastructure Issues

### 30. Weak JWT Secret Default (High)
**File:** `src/main/resources/application.yml`  
`JWT_SECRET` defaults to the literal string `your-super-secret-key-that-is-at-least-256-bits-long-for-exam-platform`. If the environment variable is not set (e.g., in development, CI, or a misconfigured deployment), the application starts with a known publicly-visible secret. Tokens signed with this key provide zero security. The app should fail fast (`IllegalStateException`) on startup if the secret is the default value in a non-`dev` profile.

### 31. SimpleBroker Cannot Be Clustered (Medium)
**File:** `config/WebSocketConfig.java`  
`config.enableSimpleBroker(...)` uses Spring's in-memory message broker. In a multi-instance, load-balanced deployment, a WebSocket notification published by Instance A (e.g., suspension from the scheduler) will only reach subscribers connected to Instance A. Students or proctors connected to Instance B will never receive it. This requires replacing `enableSimpleBroker` with a RabbitMQ STOMP broker relay (`enableStompBrokerRelay`) for any production multi-pod/multi-instance deployment.

### 32. Old Profile Photos Not Deleted from MinIO (Low)
**File:** `modules/user/UserService.java` — `uploadProfilePhoto()`  
When a user uploads a new profile photo, the new object key is stored and the presigned URL regenerated. However, the old `user.getProfilePhotoPath()` object is never deleted from the `profile-photos` MinIO bucket, causing indefinite storage accumulation per re-upload.

### 33. Proctoring MinIO Buckets Not Auto-Created at Startup (Medium)
**File:** `config/MinioConfig.java` (bucket initialization logic not verified), `scheduler/CleanupScheduler.java`  
The `violation-snapshots` and `audio-clips` MinIO buckets are referenced throughout the code (`@Value` injection, cleanup scheduler) but there is no startup bean that calls `minioClient.makeBucket()` if they don't exist. In a fresh deployment, the AI service will attempt to upload snapshots/clips to non-existent buckets, and the cleanup scheduler will fail with `BucketNotFoundException`.

### 34. Risk Score Has No Application-Level Cap at 1.0 (Low)
**File:** `modules/proctoring/ProctoringResultConsumer.java` — `handleProctoringResult()`  
`Math.max(summary.getRiskScore(), riskScore)` is used to update the score, but there is no clamp to `1.0` before persisting. The DB column is `NUMERIC(5,4)`, which allows values up to `9.9999`. If the AI service returns a malformed `riskScore > 1.0`, the value is stored as-is. Also, a value `>= 1.0` would cause a DB overflow error at `>= 10.0`, throwing a `DataException` that, combined with issue #13, would be silently swallowed.

### 36. ExamSession Has No Optimistic Locking (Medium)
**File:** `modules/session/ExamSession.java`  
`ExamSession` has no `@Version` field. Concurrent operations on the same session row — heartbeat updates (WebSocket + REST), answer saves, suspension (AI auto-suspend + proctor manual suspend simultaneously), and submission (scheduler + student's own request) — have no lost-update protection. Two concurrent writes will silently overwrite each other with no conflict error.

---

## Cross-Service Issues (AI ↔ Spring)

### 37. AI Publishes `FACE_NOT_DETECTED` but Spring Enum Has `FACE_MISSING` (Critical)
**Files:** `ai-service/app/ml/risk_aggregator.py` — `score_frame()`, `modules/proctoring/ProctoringEvent.java` — `EventType`, `modules/proctoring/ProctoringResultConsumer.java` — `updateCounters()`, `buildWarningMessage()`  
`score_frame()` emits `"event_type": "FACE_NOT_DETECTED"` in the violation dict that gets published to `proctoring.results`. Spring's `parseEnum(ProctoringEvent.EventType.class, "FACE_NOT_DETECTED", MANUAL_FLAG)` cannot find the value and falls back to `MANUAL_FLAG`. The result: every face-missing event is stored as a `MANUAL_FLAG` rather than `FACE_MISSING`, `updateCounters()` increments `manualFlagCount` instead of `faceAwayCount`, `buildWarningMessage()` returns the generic "a violation has been recorded" message instead of the actionable face-camera message, and the `faceAwayCount` column remains permanently 0 no matter how many frames have no face. **Fix:** rename `"FACE_NOT_DETECTED"` to `"FACE_MISSING"` in `risk_aggregator.py`.

### 38. AI Publishes `SUSPICIOUS_AUDIO` but Spring Enum Has `AUDIO_SPEECH` (Critical)
**Files:** `ai-service/app/ml/risk_aggregator.py` — `score_audio()`, `modules/proctoring/ProctoringEvent.java` — `EventType`, `modules/proctoring/ProctoringResultConsumer.java` — `updateCounters()`  
`score_audio()` emits `"event_type": "SUSPICIOUS_AUDIO"`. Spring's `parseEnum` falls back to `MANUAL_FLAG`. Every speech-detection event increments `manualFlagCount` not `audioViolationCount`. Audio violations are invisible in violation summaries, reports, and CSV exports — `audioViolationCount` is always 0. **Fix:** rename `"SUSPICIOUS_AUDIO"` to `"AUDIO_SPEECH"` in `risk_aggregator.py`.

### 39. AI Publishes `SUSPICIOUS_BEHAVIOR` Which Has No Spring Enum Counterpart (Critical)
**Files:** `ai-service/app/ml/risk_aggregator.py` — `score_behaviour()`, `modules/proctoring/ProctoringEvent.java` — `EventType`  
`score_behaviour()` emits `"event_type": "SUSPICIOUS_BEHAVIOR"`. `ProctoringEvent.EventType` has no such member. `parseEnum` falls back to `MANUAL_FLAG`, so XGBoost/rule-based behaviour analysis results are recorded as manual flags and increment the wrong counter. The behaviour risk score still affects the aggregate score (because `riskScore` is passed separately in the message body), but the individual event logs and per-type counters are corrupted. **Fix:** add `SUSPICIOUS_BEHAVIOR` to the `EventType` enum and add it to `updateCounters()` (mapping to a new `suspiciousBehaviorCount` column, or repurpose an existing one).

### 40. AI Publishes `MULTIPLE_PERSONS` Which Has No Spring Enum Counterpart (Critical)
**Files:** `ai-service/app/ml/risk_aggregator.py` — `score_frame()`, `modules/proctoring/ProctoringEvent.java` — `EventType`  
When `vision.extra_person` is true, `score_frame()` emits `"event_type": "MULTIPLE_PERSONS"`. Spring has `MULTIPLE_FACES` (two or more student faces) but not `MULTIPLE_PERSONS` (an extra person in the room). The enum lookup fails; the event becomes `MANUAL_FLAG`. Extra-person detection is completely invisible in all proctoring summaries and reports. **Fix:** add `MULTIPLE_PERSONS` to `EventType` and add a corresponding `multiplePersonsCount` column to `ViolationSummary` (or add a counter case to `updateCounters()`).

### 41. `GAZE_AWAY` and `FACE_MISSING` Share the Same `faceAwayCount` Counter (Medium)
**Files:** `modules/proctoring/ProctoringResultConsumer.java` — `updateCounters()`, `modules/proctoring/ViolationSummary.java`  
`updateCounters()` maps `case FACE_MISSING, GAZE_AWAY, MOUTH_OPEN` all onto `faceAwayCount`. Face missing (no face in frame), gaze away (face present but looking off screen), and mouth open are semantically distinct violations that require different response actions (student expelled vs. warned vs. noted). Merged into one counter, proctors and reports cannot distinguish between a student who left the desk entirely and one who briefly looked away. CSV exports also aggregate all three into a single "Violations" column with no breakdown. **Fix:** add `gazeAwayCount` and `mouthOpenCount` columns to `ViolationSummary` and update `updateCounters()` and the CSV export accordingly.

### 42. Inbound AI Queues Have No Dead-Letter Exchange (High)
**File:** `config/RabbitMQConfig.java`  
The `proctoring.results` queue correctly has a DLX (`proctoring.dlx`) and DLQ (`proctoring.results.dlq`). However, the three inbound queues fed by the AI service — `frame.analysis`, `audio.analysis`, and `behavior.events` — are declared with no `x-dead-letter-exchange` argument. When the AI Python consumer throws an unhandled exception and calls `channel.basic_nack(requeue=False)`, the message is discarded with no way to inspect or replay it. A transient OpenCV decode error, a MinIO timeout, or an XGBoost model load failure will permanently lose the frame/audio/event without any trace. **Fix:** declare a `ai.dlx` fanout exchange, a `ai.dlq` queue bound to it, and set `x-dead-letter-exchange` on all three inbound queues in `RabbitMQConfig.java`.

### 43. `MOUTH_OPEN` Risk Factor Applied But Never Emitted as a Violation Event (Low)
**Files:** `ai-service/app/ml/risk_aggregator.py` — `score_frame()`, `modules/proctoring/ProctoringResultConsumer.java` — `buildWarningMessage()`  
`score_frame()` computes `mouth_risk = 0.10 if vision.mouth_open` and folds it into the final weighted risk score, but unlike every other risk component it never appends a `MOUTH_OPEN` entry to `violations`. As a result, no `MOUTH_OPEN` event is ever published to `proctoring.results`. The `buildWarningMessage(MOUTH_OPEN)` case in the consumer and the `MOUTH_OPEN` counter mapping in `updateCounters()` are dead code — they can never be reached from an AI message. The mouth-open risk silently reduces the session's aggregate risk score but generates no logged event, no student warning, and no counter increment. **Fix:** add a `MOUTH_OPEN` violation dict to `score_frame()` when `vision.mouth_open is True`.

### 44. `FrameConsumer` Does Not Forward `phone_confidence` / `notes_confidence` to `VisionResult` (Medium)
**Files:** `ai-service/app/consumers/frame_consumer.py` — `process_message()`, `ai-service/app/ml/risk_aggregator.py` — `score_frame()`  
`VisionResult` has two optional confidence fields: `phone_confidence` and `notes_confidence`. These are used by `score_frame()` to set the `object_risk` weight and to populate the `"confidence"` field in the published violation dict. However, `FrameConsumer.process_message()` constructs `VisionResult` without passing these fields, leaving them at the default `0.0`. Every `PHONE_DETECTED` violation is published with `"confidence": 0.0` regardless of the underlying model's actual confidence, making the confidence data in the proctoring events table useless. **Fix:** have `object_detector.analyze()` return confidence scores and pass them as `phone_confidence=` and `notes_confidence=` when constructing `VisionResult`.

---

## Additional Backend Issues Found in Deep Audit

### 45. `AnswerService.saveAnswer()` Does Not Validate That `questionId` Belongs to the Exam (High)
**Files:** `modules/answer/AnswerService.java` — `saveAnswer()`, `modules/answer/AnswerController.java`  
`SaveAnswerRequest.questionId` is accepted and persisted without checking that the question belongs to the exam associated with the session. A student in Exam A who learns the UUID of a question in Exam B can `POST /api/sessions/{examASessionId}/answers` with Exam B's `questionId`. The answer is saved to their session with no error. If Exam B's correct answer happens to match, `calculateScore()` will award marks for it. At minimum, this pollutes the answers table with cross-exam data. **Fix:** after loading the session's exam, call `questionRepository.findByIdAndExamId(questionId, exam.getId())` and throw `ResourceNotFoundException` if absent.

### 46. `QuestionService.createQuestion()` Has No Exam Status Guard (High)
**Files:** `modules/question/QuestionService.java` — `createQuestion()`  
`updateQuestion()` and `deleteQuestion()` both throw `BusinessException` if the exam is `PUBLISHED` or `ONGOING`. `createQuestion()` has no such check. An admin can add new questions to a live exam while students are taking it. Students who received the shuffled question list at session start will never see the new question (it isn't in their Redis cache), but `calculateScore()` loads from DB and could behave inconsistently for new sessions or cache misses. **Fix:** add the same status guard (`PUBLISHED` / `ONGOING` → reject) to `createQuestion()`.

### 47. `ExamService.toDto()` Issues One `countQuestions` Query Per Exam (N+1) (Medium)
**Files:** `modules/exam/ExamService.java` — `toDto()`, `getExams()`, `getAvailableExams()`  
`toDto(Exam exam)` calls `examRepository.countQuestions(exam.getId())` as the last step. Both `getExams()` and `getAvailableExams()` map entire pages with `.map(this::toDto)`, executing one extra `COUNT` SQL query for each exam on the page. A page of 20 exams produces 21 DB round-trips (1 for the exams + 20 counts). For the admin list view with hundreds of exams across many pages, this accumulates significant latency. **Fix:** add a `@Query` JPQL query that joins and counts in one shot, or use a DTO projection with a `questionCount` subquery.

### 48. `QuestionService.toDto()` Never Shuffles Options Despite `shuffleOptions` Flag (Medium)
**Files:** `modules/question/QuestionService.java` — `toDto()`, `modules/exam/Exam.java`  
The comment "For MCQ with shuffle enabled, shuffle options per call" is present, and the code copies the options list into a new `ArrayList`. However, `Collections.shuffle()` is never called, and `exam.getShuffleOptions()` is never checked. Options are always returned in their original insertion order regardless of the exam setting. The `shuffleOptions` boolean in `CreateExamRequest` and `Exam` is effectively dead — it is stored and returned in the API but has zero effect. **Fix:** pass the exam (or the shuffle flag) to `toDto()` and conditionally call `Collections.shuffle(opts)`.

### 49. `ExamSessionService.calculateScore()` Issues One `findById` Per Answer (N+1) (Medium)
**Files:** `modules/session/ExamSessionService.java` — `calculateScore()`  
`calculateScore()` iterates over all answers for a session and calls `questionRepository.findById(answer.getQuestionId())` inside the loop. For a 50-question exam, this produces 51 sequential SQL queries (1 for answers + 50 for questions). At exam-end under the scheduler (where many sessions submit simultaneously), this multiplies into a query storm. **Fix:** collect all `questionId` values and call `questionRepository.findAllById(questionIds)` once, then build a `Map<UUID, Question>` for O(1) lookup in the loop.

### 50. `ExamSessionService.heartbeat()` Has No Session Ownership Check (Medium)
**Files:** `modules/session/ExamSessionService.java` — `heartbeat()`, `modules/session/ExamSessionController.java`  
`heartbeat(UUID sessionId)` loads the session, updates `lastHeartbeatAt`, and refreshes the Redis TTL — with no check that the calling user owns the session. Any authenticated student who knows another student's session UUID can send continuous heartbeats to that session, keeping it alive indefinitely in Redis and preventing the stale-session scheduler from terminating it. **Fix:** call `validateAccess(session)` at the top of `heartbeat()`, the same guard used by `getSession()`.

### 51. `EnrollmentService.enroll()` Has a Race Condition on Duplicate Enrollment (Medium)
**Files:** `modules/enrollment/EnrollmentService.java` — `enroll()`  
`enroll()` calls `enrollmentRepository.existsByExamIdAndUserId(examId, userId)` to guard against double-enrollment, then immediately calls `enrollmentRepository.save(enrollment)`. These are two separate SQL statements with no row-level lock between them. Under concurrent requests (e.g., double-click on the enroll button), two requests can both pass the `existsBy` check before either `save` commits, creating two `ExamEnrollment` rows for the same user/exam. If the DB has a unique constraint on `(exam_id, user_id)`, the second save throws `DataIntegrityViolationException`, which propagates as a 500 instead of a 409. If no unique constraint exists, the duplicate silently persists. **Fix:** rely on the DB unique constraint and catch `DataIntegrityViolationException` in the controller to return HTTP 409.

### 52. `ExamService.publishExam()` Does Not Validate Sum of Question Marks Against `totalMarks` (Low)
**Files:** `modules/exam/ExamService.java` — `publishExam()`, `modules/question/Question.java`  
`publishExam()` guards against publishing an exam with zero questions, but does not check whether the sum of all `question.marks` equals `exam.totalMarks`. An admin could set `totalMarks = 100` but add questions worth a total of 60 marks. Students will be scored out of a maximum of 60 but `isPassed = score >= passingMarks` compares against the configured `passingMarks`, which could be up to 100. Pass/fail logic becomes meaningless. **Fix:** add a check `sum(q.marks) == exam.totalMarks` (with a tolerance for floating-point) in `publishExam()`.

### 53. `ExamSessionService.gradeShortAnswer()` Silently Discards the `comment` Parameter (Low)
**Files:** `modules/session/ExamSessionService.java` — `gradeShortAnswer()`  
`gradeShortAnswer(sessionId, questionId, marksAwarded, comment)` logs the comment at `INFO` level but never persists it. The `Answer` entity has no `gradingComment` or `reviewNote` field. An admin who provides a comment explaining why partial credit was awarded will find no record of it anywhere in the system — not in the answer row, not in a proctoring event, not in the full session report. **Fix:** add a `gradingComment` column to the `answers` table (new migration), add the field to the `Answer` entity, and set `answer.setGradingComment(comment)` before `answerRepository.save(answer)`.

### 54. Auto-Suspend Inside `@Transactional` Listener Calls Another `@Transactional` Method (Low)
**Files:** `modules/proctoring/ProctoringResultConsumer.java` — `handleProctoringResult()`, `modules/session/ExamSessionService.java` — `suspendSession()`  
`handleProctoringResult()` is annotated `@Transactional` and, when the risk score exceeds the critical threshold, calls `sessionService.suspendSession()` — which is also `@Transactional`. By default, Spring's `REQUIRED` propagation means `suspendSession` joins the outer listener transaction. If anything after the `suspendSession` call fails (or if `suspendSession` itself throws after partial writes), the entire listener transaction rolls back, un-writing both the proctoring event and the suspension. The session appears unsuspended in the DB even though the STOMP suspend notification was already pushed to the student's browser (WebSocket side-effects cannot be rolled back). **Fix:** annotate `suspendSession()` with `@Transactional(propagation = REQUIRES_NEW)` so its commit is independent, or extract the auto-suspend trigger to an `ApplicationEvent` published after the main transaction commits.

---

## Summary Table

| # | Category | Severity | File(s) |
|---|----------|----------|---------|
| 1 | Security | Critical | `AuthService.java`, `RegisterRequest.java` |
| 2 | Security | High | `ReportController.java` |
| 3 | Security | High | `WebSocketChannelInterceptor.java` |
| 4 | Security | High | `AuthService.java` |
| 5 | Security | High | `JwtAuthenticationFilter.java` |
| 6 | Security | Low | `WebSocketConfig.java` |
| 7 | Bug | High | `ExamSessionService.java` |
| 8 | Bug | Medium | `ExamSessionService.java` |
| 9 | Bug | Medium | `ExamService.java` |
| 10 | Bug | High | `QuestionService.java` |
| 11 | Bug | Medium | `ExamWebSocketController.java` |
| 12 | Bug | Medium | `QuestionService.java` |
| 13 | Bug | High | `RabbitMQConfig.java`, `ProctoringResultConsumer.java` |
| 14 | Bug | High | `ExamScheduler.java`, `StaleSessionScheduler.java` |
| 15 | Architecture | Low | `ExamWebSocketController.java` |
| 16 | Architecture | High | `ExamWebSocketController.java` |
| 17 | Architecture | Low | `ProctoringController.java` |
| 18 | Architecture | Medium | `ReportService.java` |
| 19 | Architecture | Medium | `ReportService.java` |
| 20 | Architecture | Low | `CleanupScheduler.java` |
| 21 | Architecture | High | `ExamScheduler.java` |
| 22 | Missing | Medium | `ExamSession.java`, `User.java` |
| 23 | Missing | Medium | `ExamSessionService.java` |
| 24 | Missing | Low | `NotificationService.java` |
| 25 | Missing | Medium | `ProctoringResultConsumer.java` |
| 26 | Missing | Medium | `ExamWebSocketController.java` |
| 27 | Missing | Low | `EnrollmentController.java` |
| 28 | Missing | Low | `ReportService.java` |
| 29 | Missing | Low | `ProctoringController.java` |
| 30 | Infra | High | `application.yml` |
| 31 | Infra | Medium | `WebSocketConfig.java` |
| 32 | Infra | Low | `UserService.java` |
| 33 | Infra | Medium | `MinioConfig.java` |
| 34 | Infra | Low | `ProctoringResultConsumer.java` |
| 35 | Bug | Medium | `ExamWebSocketController.java`, `ProctoringResultConsumer.java` |
| 36 | Infra | Medium | `ExamSession.java` |
| 37 | Cross-Service | Critical | `risk_aggregator.py`, `ProctoringEvent.java`, `ProctoringResultConsumer.java` |
| 38 | Cross-Service | Critical | `risk_aggregator.py`, `ProctoringEvent.java`, `ProctoringResultConsumer.java` |
| 39 | Cross-Service | Critical | `risk_aggregator.py`, `ProctoringEvent.java` |
| 40 | Cross-Service | Critical | `risk_aggregator.py`, `ProctoringEvent.java` |
| 41 | Cross-Service | Medium | `ProctoringResultConsumer.java`, `ViolationSummary.java` |
| 42 | Infra | High | `RabbitMQConfig.java` |
| 43 | Bug (AI) | Low | `risk_aggregator.py`, `ProctoringResultConsumer.java` |
| 44 | Bug (AI) | Medium | `frame_consumer.py`, `risk_aggregator.py` |
| 45 | Security | High | `AnswerService.java` |
| 46 | Bug | High | `QuestionService.java` |
| 47 | Architecture | Medium | `ExamService.java` |
| 48 | Bug | Medium | `QuestionService.java` |
| 49 | Architecture | Medium | `ExamSessionService.java` |
| 50 | Security | Medium | `ExamSessionService.java` |
| 51 | Bug | Medium | `EnrollmentService.java` |
| 52 | Missing | Low | `ExamService.java` |
| 53 | Missing | Low | `ExamSessionService.java` |
| 54 | Architecture | Low | `ProctoringResultConsumer.java`, `ExamSessionService.java` |
