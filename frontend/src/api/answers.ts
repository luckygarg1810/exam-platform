import api from './client'
import type { AnswerDto, SaveAnswerRequest } from '../types'

export const saveAnswer = (sessionId: string, data: SaveAnswerRequest) =>
    api.post<AnswerDto>(`/sessions/${sessionId}/answers`, data).then((r) => r.data)

export const getAnswers = (sessionId: string) =>
    api.get<AnswerDto[]>(`/sessions/${sessionId}/answers`).then((r) => r.data)
