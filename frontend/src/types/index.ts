// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType?: string
  expiresIn?: number
  userId?: string
  email?: string
  name?: string
  role?: UserRole
}
export interface RegisterRequest {
  name: string; email: string; password: string
  universityRoll?: string; department?: string
}
export interface LoginRequest { email: string; password: string }
// ─── User ─────────────────────────────────────────────────────────────────────
export type UserRole = 'STUDENT' | 'PROCTOR' | 'ADMIN'
export interface UserProfile {
  id: string; name: string; email: string; role: UserRole
  universityRoll?: string; department?: string
  profilePhotoUrl?: string; isActive?: boolean; createdAt?: string
}
// ─── Exam ─────────────────────────────────────────────────────────────────────
export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED'
export interface Exam {
  id: string; title: string; description?: string; subject?: string
  createdByName?: string; startTime?: string; endTime?: string
  durationMinutes: number; totalMarks: number; passingMarks?: number
  shuffleQuestions?: boolean; shuffleOptions?: boolean; allowLateEntry?: boolean
  status: ExamStatus; questionCount?: number; createdAt?: string
}
export interface CreateExamRequest {
  title: string; description?: string; subject?: string
  startTime?: string; endTime?: string; durationMinutes: number
  totalMarks: number; passingMarks?: number
  shuffleQuestions?: boolean; shuffleOptions?: boolean; allowLateEntry?: boolean
  maxAttempts?: number
}
// ─── Question ─────────────────────────────────────────────────────────────────
export type QuestionType = 'MCQ' | 'SHORT_ANSWER'
export interface QuestionOption { key: string; text: string }
export interface Question {
  id: string; examId?: string; text: string; type: QuestionType
  options?: QuestionOption[]; correctAnswer?: string | null
  marks: number; negativeMarks?: number; orderIndex?: number
}
export interface CreateQuestionRequest {
  text: string; type: QuestionType; options?: QuestionOption[]
  correctAnswer?: string; marks: number; negativeMarks?: number; orderIndex?: number
}
// ─── Session ──────────────────────────────────────────────────────────────────
export type SessionStatus = 'ACTIVE' | 'SUBMITTED' | 'SUSPENDED' | 'TIMED_OUT'
export interface ExamSession {
  id: string; examId: string; examTitle?: string; userId: string; userName?: string
  startedAt: string; submittedAt?: string; lastHeartbeatAt?: string
  identityVerified?: boolean; isSuspended?: boolean; suspensionReason?: string
  extendedEndAt?: string; score?: number; isPassed?: boolean
  status?: SessionStatus; durationMinutes?: number
}
// ─── Answer ──────────────────────────────────────────────────────────────────
export interface SaveAnswerRequest {
  sessionId: string; questionId: string; selectedAnswer: string
}
export interface AnswerDto {
  questionId: string; selectedAnswer?: string; marksAwarded?: number; savedAt?: string
}
// ─── Enrollment ───────────────────────────────────────────────────────────────
export interface Enrollment {
  id?: string; examId?: string; examTitle?: string
  userId: string; userName: string; userEmail?: string; universityRoll?: string
  status?: string; enrolledAt?: string
}
export interface BulkEnrollResult { successCount: number; failureCount: number; errors?: string[] }
// ─── Proctoring ───────────────────────────────────────────────────────────────
export interface ViolationEvent {
  id?: string; sessionId?: string; eventType: string; severity?: string
  source?: string; confidence?: number; description?: string
  snapshotPath?: string; createdAt?: string
}
export interface ViolationSummary {
  id?: string; sessionId?: string; riskScore?: number; faceAwayCount?: number
  gazeAwayCount?: number; mouthOpenCount?: number; multipleFaceCount?: number
  phoneDetectedCount?: number; audioViolationCount?: number; tabSwitchCount?: number
  fullscreenExitCount?: number; copyPasteCount?: number; suspiciousBehaviorCount?: number
  multiplePersonsCount?: number; identityMismatchCount?: number
  proctorFlag?: boolean; proctorNote?: string; lastUpdatedAt?: string
}
export interface BehaviorEvent {
  id?: string; sessionId?: string; eventType?: string; timestamp?: string
}
// ─── Reports ──────────────────────────────────────────────────────────────────
export interface SessionResultDto {
  sessionId?: string; examId?: string; examTitle?: string; userId?: string
  studentName?: string; studentEmail?: string; universityRoll?: string
  score?: number; scorePercent?: number; totalMarks?: number; isPassed?: boolean
  enrollmentStatus?: string; isSuspended?: boolean; riskScore?: number
  proctorFlagged?: boolean; startedAt?: string; submittedAt?: string
}
export type ExamResultRow = SessionResultDto
export type StudentHistoryRow = SessionResultDto
export interface AnswerSummaryDto {
  questionId?: string; selectedAnswer?: string; marksAwarded?: number
}
export interface ViolationSummaryDto {
  tabSwitchCount?: number; fullscreenExitCount?: number; copyPasteCount?: number
  faceAwayCount?: number; gazeAwayCount?: number; mouthOpenCount?: number
  multipleFaceCount?: number; phoneDetectedCount?: number; audioViolationCount?: number
  proctorFlag?: boolean; proctorNote?: string; riskScore?: number
}
export interface ProctoringEventDto {
  id?: number; sessionId?: string; eventType?: string; severity?: string
  source?: string; confidence?: number; description?: string
  snapshotPath?: string; createdAt?: string
}
export interface FullSessionReport {
  session?: SessionResultDto; answers?: AnswerSummaryDto[]
  events?: ProctoringEventDto[]; violationSummary?: ViolationSummaryDto
}
// ─── Proctor Assignment ───────────────────────────────────────────────────────
export interface ExamProctorAssignment {
  examId?: string; examTitle?: string; examStartTime?: string; examEndTime?: string
  proctorId: string; proctorName?: string; proctorEmail?: string; assignedAt?: string
}
// ─── Pagination ───────────────────────────────────────────────────────────────
export interface Page<T> {
  content: T[]; totalElements: number; totalPages: number
  number: number; size: number; last: boolean; first?: boolean
}
