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

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { ExamManage } from './pages/admin/ExamManage'
import { LiveMonitor } from './pages/admin/LiveMonitor'
import { SessionMonitor } from './pages/admin/SessionMonitor'

// Proctor pages
import { ProctorDashboard } from './pages/proctor/ProctorDashboard'
import { InvigilateExam } from './pages/proctor/InvigilateExam'
import { SessionDetail } from './pages/proctor/SessionDetail'

// ─── Guards ───────────────────────────────────────────────────────────────────
interface ProtectedProps { role?: UserRole; children: React.ReactNode }

const ProtectedRoute: React.FC<ProtectedProps> = ({ role, children }) => {
    const { user, accessToken } = useAuthStore()
    const location = useLocation()

    if (!accessToken) return <Navigate to="/login" state={{ from: location }} replace />
    if (role && user?.role !== role) {
        const to = user?.role === 'ADMIN' ? '/admin' : user?.role === 'PROCTOR' ? '/proctor' : '/student'
        return <Navigate to={to} replace />
    }
    return <>{children}</>
}

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { accessToken, user } = useAuthStore()
    if (accessToken && user) {
        const to = user.role === 'ADMIN' ? '/admin' : user.role === 'PROCTOR' ? '/proctor' : '/student'
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
                <Spinner size="lg" />
            </div>
        )
    }

    return (
        <Routes>
            {/* Root redirect */}
            <Route path="/" element={
                user
                    ? <Navigate to={user.role === 'ADMIN' ? '/admin' : user.role === 'PROCTOR' ? '/proctor' : '/student'} replace />
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

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/exams/:examId" element={<ProtectedRoute role="ADMIN"><ExamManage /></ProtectedRoute>} />
            <Route path="/admin/monitor" element={<ProtectedRoute role="ADMIN"><LiveMonitor /></ProtectedRoute>} />
            <Route path="/admin/sessions/:sessionId" element={<ProtectedRoute role="ADMIN"><SessionMonitor /></ProtectedRoute>} />

            {/* Proctor routes */}
            <Route path="/proctor" element={<ProtectedRoute role="PROCTOR"><ProctorDashboard /></ProtectedRoute>} />
            <Route path="/proctor/exams/:examId/invigulate" element={<ProtectedRoute role="PROCTOR"><InvigilateExam /></ProtectedRoute>} />
            <Route path="/proctor/sessions/:sessionId" element={<ProtectedRoute role="PROCTOR"><SessionDetail /></ProtectedRoute>} />

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
