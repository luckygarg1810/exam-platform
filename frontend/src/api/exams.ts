import api from './client'
import type { Exam, CreateExamRequest, Page } from '../types'

export const listExams = (page = 0, size = 20, sortBy = 'startTime', sortDir = 'ASC') =>
    api.get<Page<Exam>>('/exams', { params: { page, size, sortBy, sortDir } }).then((r) => r.data)

export const availableExams = (page = 0, size = 20) =>
    api.get<Page<Exam>>('/exams/available', { params: { page, size } }).then((r) => r.data)

export const getExam = (examId: string) =>
    api.get<Exam>(`/exams/${examId}`).then((r) => r.data)

export const createExam = (data: CreateExamRequest) =>
    api.post<Exam>('/exams', data).then((r) => r.data)

export const updateExam = (examId: string, data: CreateExamRequest) =>
    api.put<Exam>(`/exams/${examId}`, data).then((r) => r.data)

export const deleteExam = (examId: string) =>
    api.delete(`/exams/${examId}`)

export const publishExam = (examId: string) =>
    api.post<Exam>(`/exams/${examId}/publish`).then((r) => r.data)

export const getMyAssignedExams = () =>
    api.get<Exam[]>('/exams/my-assigned').then((r) => r.data)
