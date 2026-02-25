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
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Live Monitor</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {ongoingSessions.length} active session{ongoingSessions.length !== 1 ? 's' : ''} ·{' '}
                        <span className={ws.isConnected() ? 'text-green-600' : 'text-red-500'}>
                            {ws.isConnected() ? 'WS connected' : 'WS disconnected'}
                        </span>
                    </p>
                </div>
                <button onClick={() => navigate('/admin')} className="text-sm text-gray-500 hover:text-gray-700">
                    ← Dashboard
                </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
                {/* Sessions grid */}
                <div className="lg:col-span-2">
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Active Sessions</h2>
                    {loading ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                    ) : ongoingSessions.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 text-center py-10 text-gray-400">
                            No active sessions right now.
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                            {ongoingSessions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => navigate(`/admin/sessions/${s.id}`)}
                                    className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-900">{s.userName}</span>
                                        <Badge variant={sessionStatusBadge(s.isSuspended ? 'SUSPENDED' : s.submittedAt ? 'SUBMITTED' : 'ACTIVE')} label={s.isSuspended ? 'SUSPENDED' : s.submittedAt ? 'SUBMITTED' : 'ACTIVE'} />
                                    </div>
                                    <p className="text-xs text-gray-500 mb-1">{s.examTitle}</p>
                                    <p className="text-xs text-gray-400">
                                        Session #{s.id} · since {new Date(s.startedAt).toLocaleTimeString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Alert feed */}
                <div>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                        Violation Feed ({alerts.length})
                    </h2>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-h-[calc(100vh-220px)] overflow-y-auto">
                        {alerts.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">No alerts yet.</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {alerts.map((a, i) => (
                                    <div key={i} className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer" onClick={() => a.sessionId && navigate(`/admin/sessions/${a.sessionId}`)}>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-xs font-medium text-red-600">{a.type}</span>
                                            <span className="text-xs text-gray-400">{a.time.toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-600">{a.message}</p>
                                        {a.sessionId > 0 && <p className="text-xs text-blue-500 mt-0.5">Session #{a.sessionId}</p>}
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
