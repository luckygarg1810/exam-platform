import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, sessionStatusBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useWebSocket } from '../../hooks/useWebSocket'
import { getActiveSessions } from '../../api/sessions'
import { ExamSession } from '../../types'
import toast from 'react-hot-toast'

interface Alert { sessionId: number; message: string; type: string; time: Date }

export const LiveMonitor: React.FC = () => {
    const navigate = useNavigate()
    const [sessions, setSessions] = useState<ExamSession[]>([])
    const [loading, setLoading] = useState(true)
    const [alerts, setAlerts] = useState<Alert[]>([])

    const ws = useWebSocket({
        onAdminAlert: msg => {
            try {
                const data = typeof msg === 'string' ? JSON.parse(msg) : msg
                setAlerts(a => [{ sessionId: data.sessionId ?? 0, message: data.message ?? msg, type: data.type ?? 'ALERT', time: new Date() }, ...a.slice(0, 49)])
            } catch {
                setAlerts(a => [{ sessionId: 0, message: String(msg), type: 'ALERT', time: new Date() }, ...a.slice(0, 49)])
            }
        },
    })

    const load = () =>
        getActiveSessions().then(p => setSessions(p.content ?? [])).catch(() => toast.error('Failed to load sessions')).finally(() => setLoading(false))

    useEffect(() => {
        load()
        const interval = setInterval(load, 30_000)
        return () => clearInterval(interval)
    }, [])

    const ongoingSessions = sessions.filter(s => !s.isSuspended && !s.submittedAt)

    return (
        <Layout>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-6 animate-fade-in-down">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Administration</p>
                            <h1 className="text-2xl font-black text-gray-900">Live Monitor</h1>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-gray-500 text-sm">
                                    {ongoingSessions.length} active session{ongoingSessions.length !== 1 ? 's' : ''}
                                </span>
                                <span className="flex items-center gap-1.5 text-sm">
                                    <span className={`w-2 h-2 rounded-full ${ws.isConnected() ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                                    <span className={ws.isConnected() ? 'text-emerald-600' : 'text-red-500'}>
                                        {ws.isConnected() ? 'Live' : 'Disconnected'}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => navigate('/admin')}
                        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-semibold bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl transition-all border border-gray-200">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Dashboard
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
                {/* Sessions grid */}
                <div className="lg:col-span-2">
                    <p className="section-title">Active Sessions</p>
                    {loading ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                    ) : ongoingSessions.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 text-center py-12 shadow-card">
                            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 text-sm">No active sessions right now.</p>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                            {ongoingSessions.map((s, i) => (
                                <div
                                    key={s.id}
                                    onClick={() => navigate(`/admin/sessions/${s.id}`)}
                                    className={`group bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 animate-fade-in-up animate-fill-both stagger-${Math.min(i + 1, 6)}`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center text-xs font-bold text-violet-600">
                                                {s.userName?.charAt(0)?.toUpperCase() ?? '?'}
                                            </div>
                                            <span className="text-sm font-bold text-gray-900 group-hover:text-violet-700 transition-colors">{s.userName}</span>
                                        </div>
                                        <Badge variant={sessionStatusBadge(s.isSuspended ? 'SUSPENDED' : s.submittedAt ? 'SUBMITTED' : 'ACTIVE')} label={s.isSuspended ? 'SUSPENDED' : s.submittedAt ? 'SUBMITTED' : 'ACTIVE'} />
                                    </div>
                                    <p className="text-xs text-gray-500 mb-1 ml-10">{s.examTitle}</p>
                                    <p className="text-xs text-gray-400 ml-10">#{s.id} · since {new Date(s.startedAt).toLocaleTimeString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Alert feed */}
                <div>
                    <p className="section-title flex items-center gap-2">
                        Violation Feed
                        {alerts.length > 0 && (
                            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length}</span>
                        )}
                    </p>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-violet">
                        {alerts.length === 0 ? (
                            <div className="text-center py-10 px-4">
                                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-5 h-5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                <p className="text-gray-400 text-sm">No alerts yet.</p>
                                <p className="text-gray-300 text-xs mt-1">Violations appear here in real-time.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {alerts.map((a, i) => (
                                    <div key={i} className="alert-item animate-slide-in-right"
                                        onClick={() => a.sessionId && navigate(`/admin/sessions/${a.sessionId}`)}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                                ⚠ {a.type}
                                            </span>
                                            <span className="text-xs text-gray-400">{a.time.toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed">{a.message}</p>
                                        {a.sessionId > 0 && <p className="text-xs text-violet-500 mt-0.5 font-medium">Session #{a.sessionId} →</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    )
}
