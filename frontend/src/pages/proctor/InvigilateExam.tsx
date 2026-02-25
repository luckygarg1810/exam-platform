import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, sessionStatusBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useWebSocket } from '../../hooks/useWebSocket'
import { getActiveSessions } from '../../api/sessions'
import { ExamSession } from '../../types'
import toast from 'react-hot-toast'

interface Alert { sessionId: number; message: string; type: string; time: Date }

export const InvigilateExam: React.FC = () => {
    const { examId } = useParams<{ examId: string }>()
    const navigate = useNavigate()

    const [sessions, setSessions] = useState<ExamSession[]>([])
    const [loading, setLoading] = useState(true)
    const [alerts, setAlerts] = useState<Alert[]>([])

    const ws = useWebSocket({
        examId: examId!,
        onExamAlert: msg => {
            try {
                const data = typeof msg === 'string' ? JSON.parse(msg) : msg
                setAlerts(a => [{ sessionId: data.sessionId ?? 0, message: data.message ?? String(msg), type: data.type ?? 'ALERT', time: new Date() }, ...a.slice(0, 99)])
            } catch {
                setAlerts(a => [{ sessionId: 0, message: String(msg), type: 'ALERT', time: new Date() }, ...a.slice(0, 99)])
            }
        },
    })

    const load = () =>
        getActiveSessions().then(p => setSessions((p.content ?? []).filter((s: ExamSession) => s.examId === examId)))
            .catch(() => toast.error('Failed to load sessions'))
            .finally(() => setLoading(false))

    useEffect(() => {
        load()
        const interval = setInterval(load, 30_000)
        return () => clearInterval(interval)
    }, [examId]) // eslint-disable-line

    const activeSessions = sessions.filter(s => !s.isSuspended && !s.submittedAt)

    return (
        <Layout>
            <button onClick={() => navigate('/proctor')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
                ← Dashboard
            </button>

            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Invigilating Exam #{examId}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''} ·{' '}
                        <span className={ws.isConnected() ? 'text-green-600' : 'text-red-500'}>
                            {ws.isConnected() ? 'WS live' : 'WS disconnected'}
                        </span>
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
                {/* Sessions list */}
                <div className="lg:col-span-2">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Student Sessions</h2>
                    {loading ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                    ) : sessions.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 text-center py-10 text-gray-400 text-sm">
                            No sessions for this exam.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sessions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => navigate(`/proctor/sessions/${s.id}`)}
                                    className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between cursor-pointer hover:shadow-sm transition-shadow"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{s.userName}</p>
                                        <p className="text-xs text-gray-400">Session #{s.id} · {new Date(s.startedAt).toLocaleTimeString()}</p>
                                    </div>
                                    <Badge variant={sessionStatusBadge(s.isSuspended ? 'SUSPENDED' : s.submittedAt ? 'SUBMITTED' : 'ACTIVE')} label={s.isSuspended ? 'SUSPENDED' : s.submittedAt ? 'SUBMITTED' : 'ACTIVE'} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Real-time alert feed */}
                <div>
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                        Live Alerts ({alerts.length})
                    </h2>
                    <div className="bg-white rounded-xl border border-gray-200 max-h-[calc(100vh-240px)] overflow-y-auto">
                        {alerts.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">Watching for violations…</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {alerts.map((a, i) => (
                                    <div
                                        key={i}
                                        className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                                        onClick={() => a.sessionId && navigate(`/proctor/sessions/${a.sessionId}`)}
                                    >
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-xs font-semibold text-red-600">{a.type}</span>
                                            <span className="text-xs text-gray-400">{a.time.toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-600">{a.message}</p>
                                        {a.sessionId > 0 && <p className="text-xs text-blue-500 mt-0.5">Session #{a.sessionId} →</p>}
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
