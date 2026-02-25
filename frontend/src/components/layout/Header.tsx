import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { logout } from '../../api/auth'
import toast from 'react-hot-toast'

export const Header: React.FC = () => {
    const { user, clearAuth } = useAuthStore()
    const navigate = useNavigate()

    const handleLogout = async () => {
        try { await logout() } catch { }
        clearAuth()
        navigate('/login')
    }

    const dashboardPath =
        user?.role === 'ADMIN' ? '/admin' :
            user?.role === 'PROCTOR' ? '/proctor' : '/student'

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link to={dashboardPath} className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">GBU</span>
                        </div>
                        <span className="font-semibold text-gray-900">Exam Platform</span>
                    </Link>

                    {user && (
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500 hidden sm:block">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                                    {user.role}
                                </span>
                                {user.name}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                            >
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
