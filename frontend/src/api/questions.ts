import api from './client'
import type { Question, CreateQuestionRequest, Page } from '../types'

export const listQuestions = (examId: string, page = 0, size = 50) =>
    api.get<Page<Question>>(`/exams/${examId}/questions`, { params: { page, size } }).then((r) => r.data)

export const getShuffledQuestions = (examId: string) =>
    api.get<Question[]>(`/exams/${examId}/questions/shuffled`).then((r) => r.data)

export const createQuestion = (examId: string, data: CreateQuestionRequest) =>
    api.post<Question>(`/exams/${examId}/questions`, data).then((r) => r.data)

export const updateQuestion = (examId: string, questionId: string, data: CreateQuestionRequest) =>
    api.put<Question>(`/exams/${examId}/questions/${questionId}`, data).then((r) => r.data)

export const deleteQuestion = (examId: string, questionId: string) =>
    api.delete(`/exams/${examId}/questions/${questionId}`)

export const importQuestions = (targetExamId: string, sourceExamId: string, questionIds: string[]) =>
    api.post<Question[]>(`/exams/${targetExamId}/questions/import`, { sourceExamId, questionIds }).then((r) => r.data)

export const importQuestionsFromExcel = (examId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<Question[]>(`/exams/${examId}/questions/import/excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then((r) => r.data)
}
