import { create } from 'zustand'
import type { UserProfile } from '../types'

interface AuthState {
    user: UserProfile | null
    accessToken: string | null
    setAuth: (user: UserProfile, accessToken: string, refreshToken: string) => void
    clearAuth: () => void
    setUser: (user: UserProfile) => void
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    accessToken: localStorage.getItem('accessToken'),

    setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
        set({ user, accessToken })
    },

    clearAuth: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({ user: null, accessToken: null })
    },

    setUser: (user) => set({ user }),
}))
