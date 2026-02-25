import api from './client'
import type { TokenResponse, RegisterRequest, LoginRequest, UserProfile } from '../types'
import axios from 'axios'

export const register = (data: RegisterRequest) =>
    api.post<TokenResponse>('/auth/register', data).then((r) => r.data)

export const login = (data: LoginRequest) =>
    api.post<TokenResponse>('/auth/login', data).then((r) => r.data)

export const logout = () => api.post('/auth/logout')

export const refreshToken = (refreshToken: string) =>
    axios.post<TokenResponse>('/api/auth/refresh', { refreshToken }).then((r) => r.data)

export const getMe = () => api.get<UserProfile>('/users/me').then((r) => r.data)

export const uploadPhoto = (file: File, isIdPhoto: boolean) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('isIdPhoto', String(isIdPhoto))
    return api.post<{ url: string }>('/users/me/photo', fd).then((r) => r.data)
}
