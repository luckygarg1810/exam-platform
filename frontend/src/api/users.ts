import api from './client'
import type { UserProfile, Page } from '../types'

export const listUsers = (search?: string, page = 0, size = 20) =>
    api.get<Page<UserProfile>>('/users', { params: { search, page, size } }).then((r) => r.data)

export const getUserById = (userId: string) =>
    api.get<UserProfile>(`/users/${userId}`).then((r) => r.data)

export const changeRole = (userId: string, role: string) =>
    api.put(`/users/${userId}/role`, { role })

export const deleteUser = (userId: string) =>
    api.delete(`/users/${userId}`)

export const updateProfile = (data: { name?: string; department?: string; universityRoll?: string }) =>
    api.put<UserProfile>('/users/me', data).then((r) => r.data)
