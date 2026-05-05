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
                setAlerts(a => [{
                    sessionId: data.sessionId ?? 0,
                    // broadcastExamAlert sends 'description'; older events may use 'message'
                    message: data.description || data.message || String(msg),
                    type: data.eventType ?? data.type ?? 'ALERT',
                    time: new Date()
                }, ...a.slice(0, 99)])
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
            <button onClick={() => navigate('/teacher')}
                className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-semibold mb-5 group">
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Dashboard
            </button>

            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-5 animate-fade-in-up">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900">Invigilating Exam #{examId}</h1>
                            <p className="text-gray-500 text-sm mt-0.5">{activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                        <span className={`w-2 h-2 rounded-full ${ws.isConnected() ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        <span className={`text-xs font-semibold ${ws.isConnected() ? 'text-emerald-600' : 'text-red-500'}`}>{ws.isConnected() ? 'Connected' : 'Disconnected'}</span>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
                {/* Sessions list */}
                <div className="lg:col-span-2">
                    <h2 className="section-title mb-3">Student Sessions</h2>
                    {loading ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                    ) : sessions.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-card text-center py-10">
                            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                                <svg className="w-5 h-5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            </div>
                            <p className="text-gray-400 text-sm">No sessions for this exam.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sessions.map((s, i) => (
                                <div key={s.id} onClick={() => navigate(`/teacher/sessions/${s.id}`)}
                                    className={`bg-white rounded-2xl border border-gray-100 shadow-card p-4 flex items-center gap-3 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 stagger-${Math.min(i + 1, 6)}`}>
                                    <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-700 font-black text-sm flex-shrink-0">
                                        {s.userName?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900">{s.userName}</p>
                                        <p className="text-xs text-gray-400">Session #{s.id} &middot; {new Date(s.startedAt).toLocaleTimeString()}</p>
                                    </div>
                                    <Badge variant={sessionStatusBadge(s.isSuspended ? 'SUSPENDED' : s.submittedAt ? 'SUBMITTED' : 'ACTIVE')} label={s.isSuspended ? 'SUSPENDED' : s.submittedAt ? 'SUBMITTED' : 'ACTIVE'} />
                                    <svg className="w-4 h-4 text-violet-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Real-time alert feed */}
                <div>
                    <h2 className="section-title mb-3 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${ws.isConnected() ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`}></span>
                        Live Alerts ({alerts.length})
                    </h2>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-card max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-violet">
                        {alerts.length === 0 ? (
                            <div className="text-center py-10">
                                <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                                    <svg className="w-5 h-5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </div>
                                <p className="text-gray-400 text-sm">Watching for violations…</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {alerts.map((a, i) => (
                                    <div key={i} className="px-4 py-3 hover:bg-violet-50/40 cursor-pointer transition-colors"
                                        onClick={() => a.sessionId && navigate(`/teacher/sessions/${a.sessionId}`)}
                                    >
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">{a.type}</span>
                                            <span className="text-xs text-gray-400">{a.time.toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1">{a.message}</p>
                                        {a.sessionId > 0 && <p className="text-xs text-violet-500 font-semibold mt-0.5">Session #{a.sessionId} →</p>}
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
