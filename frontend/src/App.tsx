import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { getMe } from './api/auth'
import { Spinner } from './components/ui/Spinner'
import { UserRole } from './types'

// Auth pages
import { Login } from './pages/auth/Login'
import { Register } from './pages/auth/Register'

// Student pages
import { StudentDashboard } from './pages/student/StudentDashboard'
import { ExamDetail } from './pages/student/ExamDetail'
import { ExamSession } from './pages/student/ExamSession'
import { Results } from './pages/student/Results'
import { Profile } from './pages/student/Profile'

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard'

import { LiveMonitor } from './pages/admin/LiveMonitor'
import { SessionMonitor } from './pages/admin/SessionMonitor'

// Teacher pages
import { TeacherDashboard } from './pages/teacher/TeacherDashboard'
import { TeacherExamManage } from './pages/teacher/TeacherExamManage'
import { InvigilateExam } from './pages/teacher/InvigilateExam'
import { SessionDetail } from './pages/teacher/SessionDetail'

// ─── Guards ───────────────────────────────────────────────────────────────────
interface ProtectedProps { role?: UserRole; children: React.ReactNode }

const ProtectedRoute: React.FC<ProtectedProps> = ({ role, children }) => {
    const { user, accessToken } = useAuthStore()
    const location = useLocation()

    if (!accessToken) return <Navigate to="/login" state={{ from: location }} replace />
    if (role && user?.role !== role) {
        const to = user?.role === 'ADMIN' ? '/admin' : user?.role === 'TEACHER' ? '/teacher' : '/student'
        return <Navigate to={to} replace />
    }
    return <>{children}</>
}

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { accessToken, user } = useAuthStore()
    if (accessToken && user) {
        const to = user.role === 'ADMIN' ? '/admin' : user.role === 'TEACHER' ? '/teacher' : '/student'
        return <Navigate to={to} replace />
    }
    return <>{children}</>
}

// ─── App ──────────────────────────────────────────────────────────────────────
const AppInner: React.FC = () => {
    const { accessToken, setAuth, clearAuth, user } = useAuthStore()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!accessToken) { setLoading(false); return }
        getMe()
            .then(u => setAuth(u, accessToken, localStorage.getItem('refreshToken') ?? ''))
            .catch(() => clearAuth())
            .finally(() => setLoading(false))
    }, []) // eslint-disable-line

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center animate-fade-in-up">
                    <div className="mx-auto w-16 h-16 mb-6">
                        <img src="/gbu-logo.png" alt="GBU Logo" className="w-16 h-16 object-contain" />
                    </div>
                    <Spinner size="lg" className="mx-auto text-violet-500" />
                    <p className="mt-4 text-gray-400 text-sm font-medium">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <Routes>
            {/* Root redirect */}
            <Route path="/" element={
                user
                    ? <Navigate to={user.role === 'ADMIN' ? '/admin' : user.role === 'TEACHER' ? '/teacher' : '/student'} replace />
                    : <Navigate to="/login" replace />
            } />

            {/* Guest routes */}
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

            {/* Student routes */}
            <Route path="/student" element={<ProtectedRoute role="STUDENT"><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/exams/:examId" element={<ProtectedRoute role="STUDENT"><ExamDetail /></ProtectedRoute>} />
            <Route path="/student/session/:sessionId" element={<ProtectedRoute role="STUDENT"><ExamSession /></ProtectedRoute>} />
            <Route path="/student/results" element={<ProtectedRoute role="STUDENT"><Results /></ProtectedRoute>} />

            {/* Shared profile route (any authenticated user) */}
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            {/* Admin routes - User management only */}
            <Route path="/admin" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/monitor" element={<ProtectedRoute role="ADMIN"><LiveMonitor /></ProtectedRoute>} />
            <Route path="/admin/sessions/:sessionId" element={<ProtectedRoute role="ADMIN"><SessionMonitor /></ProtectedRoute>} />

            {/* Teacher routes - Exam management and proctoring */}
            <Route path="/teacher" element={<ProtectedRoute role="TEACHER"><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/teacher/exams/:examId" element={<ProtectedRoute role="TEACHER"><TeacherExamManage /></ProtectedRoute>} />
            <Route path="/teacher/exams/:examId/invigulate" element={<ProtectedRoute role="TEACHER"><InvigilateExam /></ProtectedRoute>} />
            <Route path="/teacher/sessions/:sessionId" element={<ProtectedRoute role="TEACHER"><SessionDetail /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export const App: React.FC = () => (
    <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <AppInner />
    </BrowserRouter>
)
