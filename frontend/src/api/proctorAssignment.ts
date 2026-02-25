import api from './client'
import type { ExamProctorAssignment } from '../types'

export const assignProctor = (examId: string, proctorId: string) =>
    api.post<ExamProctorAssignment>(`/exams/${examId}/proctors/${proctorId}`).then((r) => r.data)

export const unassignProctor = (examId: string, proctorId: string) =>
    api.delete(`/exams/${examId}/proctors/${proctorId}`)

export const getProctorsForExam = (examId: string) =>
    api.get<ExamProctorAssignment[]>(`/exams/${examId}/proctors`).then((r) => r.data)

export const getExamsForProctor = (proctorId: string) =>
    api.get(`/users/${proctorId}/assigned-exams`).then((r) => r.data)
