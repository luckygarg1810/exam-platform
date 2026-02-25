import api from './client'
import type { Enrollment, BulkEnrollResult, Page } from '../types'

export const enrollStudent = (examId: string, universityRoll: string) =>
    api.post<Enrollment>(`/exams/${examId}/enrollments`, { universityRoll }).then((r) => r.data)

export const bulkEnroll = (examId: string, rolls: string[]) =>
    api.post<BulkEnrollResult>(`/exams/${examId}/enrollments/bulk`, { rolls }).then((r) => r.data)

export const unenrollStudent = (examId: string, userId: string) =>
    api.delete(`/exams/${examId}/enrollments/${userId}`)

export const listEnrollments = (examId: string, page = 0, size = 50) =>
    api.get<Page<Enrollment>>(`/exams/${examId}/enrollments`, { params: { page, size } }).then((r) => r.data)
