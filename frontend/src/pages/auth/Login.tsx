import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { login, getMe } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'

export const Login: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { setAuth } = useAuthStore()
    const [form, setForm] = useState({ email: '', password: '' })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await login(form)
            localStorage.setItem('accessToken', res.accessToken)
            localStorage.setItem('refreshToken', res.refreshToken)
            const user = await getMe()
            setAuth(user, res.accessToken, res.refreshToken)
            const from = (location.state as any)?.from?.pathname
            const to = from || (user.role === 'ADMIN' ? '/admin' : user.role === 'PROCTOR' ? '/proctor' : '/student')
            navigate(to, { replace: true })
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Invalid credentials')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                        <span className="text-white font-bold text-lg">GBU</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Sign in to Exam Platform</h1>
                    <p className="text-gray-500 text-sm mt-1">Enter your credentials to continue</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email" required autoFocus
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                                type="password" required
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                            />
                        </div>
                        <Button type="submit" loading={loading} className="w-full justify-center">
                            Sign In
                        </Button>
                    </form>

                    <p className="text-center text-sm text-gray-500 mt-6">
                        New student?{' '}
                        <Link to="/register" className="text-blue-600 font-medium hover:underline">
                            Create an account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
