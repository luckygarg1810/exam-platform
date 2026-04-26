import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { logout } from '../../api/auth'

const roleConfig = {
    ADMIN: {
        label: 'Admin',
        badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        avatar: 'bg-gradient-to-br from-amber-400 to-orange-500',
        dot: 'bg-amber-400',
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    PROCTOR: {
        label: 'Proctor',
        badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        avatar: 'bg-gradient-to-br from-emerald-400 to-teal-500',
        dot: 'bg-emerald-400',
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
        ),
    },
    STUDENT: {
        label: 'Student',
        badge: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
        avatar: 'bg-gradient-to-br from-violet-500 to-purple-600',
        dot: 'bg-violet-400',
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
        ),
    },
} as const

function getInitials(name: string): string {
    return name
        .split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
}

export const Header: React.FC = () => {
    const { user, clearAuth } = useAuthStore()
    const navigate = useNavigate()
    const [loggingOut, setLoggingOut] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const handleLogout = async () => {
        setLoggingOut(true)
        setDropdownOpen(false)
        try { await logout() } catch { }
        clearAuth()
        navigate('/login')
    }

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const dashboardPath =
        user?.role === 'ADMIN' ? '/admin' :
            user?.role === 'PROCTOR' ? '/proctor' : '/student'

    const role = user?.role as keyof typeof roleConfig | undefined
    const rc = role ? roleConfig[role] : null
    const initials = user ? getInitials(user.name) : '?'

    return (
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200" style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)' }}>
            {/* Violet accent line at very top */}
            <div className="h-0.5 bg-gradient-to-r from-violet-600 via-purple-500 to-violet-400" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-15 py-3">

                    {/* ── Logo ── */}
                    <Link to={dashboardPath} className="flex items-center gap-3 group">
                        <img
                            src="/gbu-logo.png"
                            alt="GBU Logo"
                            className="w-9 h-9 object-contain rounded-xl group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="hidden sm:flex flex-col leading-none">
                            <span className="font-bold text-gray-900 text-[15px] tracking-tight">Exam Platform</span>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Gautam Buddha University</span>
                        </div>
                    </Link>

                    {/* ── Right: user dropdown ── */}
                    {user && rc && (
                        <div className="flex items-center gap-3">
                            {/* Role badge (desktop) */}
                            <span className={`hidden md:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${rc.badge}`}>
                                {rc.icon}
                                {rc.label}
                            </span>

                            {/* Divider */}
                            <div className="hidden md:block w-px h-6 bg-gray-200" />

                            {/* User menu trigger */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(v => !v)}
                                    className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all duration-150 group"
                                >
                                    {/* Avatar */}
                                    <div className="relative">
                                        {user.profilePhotoUrl ? (
                                            <img
                                                src={user.profilePhotoUrl}
                                                alt={user.name}
                                                className="w-8 h-8 rounded-xl object-cover shadow-sm"
                                            />
                                        ) : (
                                            <div className={`w-8 h-8 rounded-xl ${rc.avatar} flex items-center justify-center shadow-sm`}>
                                                <span className="text-white text-xs font-bold tracking-wide">{initials}</span>
                                            </div>
                                        )}
                                        {/* Online dot */}
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${rc.dot} rounded-full border-2 border-white`} />
                                    </div>

                                    {/* Name */}
                                    <div className="hidden sm:flex flex-col items-start leading-none">
                                        <span className="text-sm font-semibold text-gray-800">{user.name}</span>
                                        <span className="text-[11px] text-gray-400 mt-0.5">{user.email ?? rc.label}</span>
                                    </div>

                                    {/* Chevron */}
                                    <svg
                                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* ── Dropdown ── */}
                                {dropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden animate-fade-in-down z-50">
                                        {/* Header section */}
                                        <div className="px-4 py-3.5 bg-gray-50 border-b border-gray-100">
                                            <div className="flex items-center gap-3">
                                                {user.profilePhotoUrl ? (
                                                    <img
                                                        src={user.profilePhotoUrl}
                                                        alt={user.name}
                                                        className="w-10 h-10 rounded-xl object-cover shadow-sm flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className={`w-10 h-10 rounded-xl ${rc.avatar} flex items-center justify-center shadow-sm flex-shrink-0`}>
                                                        <span className="text-white text-sm font-bold">{initials}</span>
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                                                    {user.email && <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>}
                                                    <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${rc.badge}`}>
                                                        {rc.icon}
                                                        {rc.label}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* My Profile + Sign out */}
                                        <div className="p-2 space-y-0.5">
                                            {/* My Profile link */}
                                            <Link
                                                to="/profile"
                                                onClick={() => setDropdownOpen(false)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors font-medium group"
                                            >
                                                <div className="w-7 h-7 rounded-lg bg-violet-50 group-hover:bg-violet-100 flex items-center justify-center transition-colors">
                                                    <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                                My Profile
                                            </Link>

                                            {/* Divider */}
                                            <div className="my-1 border-t border-gray-100" />

                                            {/* Sign out */}
                                            <button
                                                onClick={handleLogout}
                                                disabled={loggingOut}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors font-medium group"
                                            >
                                                <div className="w-7 h-7 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                                                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                    </svg>
                                                </div>
                                                {loggingOut ? 'Signing out…' : 'Sign out'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
