import api from './client'
import type { ViolationEvent, ViolationSummary, BehaviorEvent, Page } from '../types'

export const getProctoringEvents = (sessionId: string, page = 0, size = 50) =>
    api.get<Page<ViolationEvent>>(`/proctoring/sessions/${sessionId}/events`, { params: { page, size } }).then((r) => r.data)

export const getViolationSummary = (sessionId: string) =>
    api.get<ViolationSummary>(`/proctoring/sessions/${sessionId}/summary`).then((r) => r.data)

export const addFlag = (sessionId: string, eventType: string, description: string) =>
    api.post(`/proctoring/sessions/${sessionId}/flag`, { eventType, description })

export const clearFlag = (sessionId: string) =>
    api.post(`/proctoring/sessions/${sessionId}/clear`)

export const addNote = (sessionId: string, note: string) =>
    api.post(`/proctoring/sessions/${sessionId}/notes`, { note })

export const suspendSession = (sessionId: string, reason: string) =>
    api.post(`/proctoring/sessions/${sessionId}/suspend`, { reason })

export const getBehaviorEvents = (sessionId: string, page = 0, size = 50) =>
    api.get<Page<BehaviorEvent>>(`/proctoring/sessions/${sessionId}/behavior-events`, { params: { page, size } }).then((r) => r.data)
