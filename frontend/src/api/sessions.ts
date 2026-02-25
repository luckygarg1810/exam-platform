import api from './client'
import type { ExamSession, Page } from '../types'

export const startSession = (examId: string) =>
    api.post<ExamSession>('/sessions/start', null, { params: { examId } }).then((r) => r.data)

export const getSession = (sessionId: string) =>
    api.get<ExamSession>(`/sessions/${sessionId}`).then((r) => r.data)

export const heartbeat = (sessionId: string) =>
    api.post(`/sessions/${sessionId}/heartbeat`)

export const submitSession = (sessionId: string) =>
    api.post<ExamSession>(`/sessions/${sessionId}/submit`).then((r) => r.data)

export const getActiveSessions = (page = 0, size = 50) =>
    api.get<Page<ExamSession>>('/sessions/active', { params: { page, size } }).then((r) => r.data)

export const verifyIdentity = (sessionId: string, selfieBase64: string) =>
    api.post(`/sessions/${sessionId}/verify-identity`, { selfieBase64 })

export const reinstateSession = (sessionId: string, reason?: string) =>
    api.post(`/sessions/${sessionId}/reinstate`, { reason })
