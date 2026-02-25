import api from './client'
import type { ExamResultRow, FullSessionReport, StudentHistoryRow, Page } from '../types'

export const getExamResults = (examId: string, page = 0, size = 50) =>
    api.get<Page<ExamResultRow>>(`/reports/exams/${examId}/results`, { params: { page, size } }).then((r) => r.data)

export const exportExamCsv = (examId: string) =>
    api.get(`/reports/exams/${examId}/export`, { responseType: 'blob' }).then((r) => r.data)

export const getFullSessionReport = (sessionId: string) =>
    api.get<FullSessionReport>(`/reports/sessions/${sessionId}/full`).then((r) => r.data)

export const getStudentHistory = (userId: string, page = 0, size = 20) =>
    api.get<Page<StudentHistoryRow>>(`/reports/students/${userId}/history`, { params: { page, size } }).then((r) => r.data)
