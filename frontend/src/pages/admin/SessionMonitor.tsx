import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, sessionStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { getSession } from '../../api/sessions'
import { getProctoringEvents, getViolationSummary, suspendSession } from '../../api/proctoring'
import { getFullSessionReport } from '../../api/reports'
import { ExamSession, ViolationEvent, ViolationSummary, FullSessionReport } from '../../types'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

export const SessionMonitor: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>()
    const navigate = useNavigate()
    const sid = sessionId!

    const [session, setSession] = useState<ExamSession | null>(null)
    const [events, setEvents] = useState<ViolationEvent[]>([])
    const [summary, setSummary] = useState<ViolationSummary | null>(null)
    const [report, setReport] = useState<FullSessionReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [confirmSuspend, setConfirmSuspend] = useState(false)
    const [suspendReason, setSuspendReason] = useState('')
    const [suspending, setSuspending] = useState(false)
    const [tab, setTab] = useState<'events' | 'report'>('events')

    const load = async () => {
        try {
            const [sess, evtsPage, sum] = await Promise.all([
                getSession(sid), getProctoringEvents(sid), getViolationSummary(sid),
            ])
            setSession(sess); setEvents(evtsPage.content ?? []); setSummary(sum)
            if (tab === 'report') {
                const r = await getFullSessionReport(sid)
                setReport(r)
            }
        } catch { toast.error('Failed to load session data') }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [sid]) // eslint-disable-line

    const handleSuspend = async () => {
        if (!suspendReason.trim()) { toast.error('Enter a reason'); return }
        setSuspending(true)
        try {
            await suspendSession(sid, suspendReason)
            toast.success('Session suspended')
            setConfirmSuspend(false); setSuspendReason(''); load()
        } catch (e: any) { toast.error(e.response?.data?.message || 'Failed') }
        finally { setSuspending(false) }
    }

    if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size="lg" /></div></Layout>
    if (!session) return <Layout><p className="text-gray-500">Session not found.</p></Layout>

    return (
        <Layout>
            <button onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-semibold mb-5 group">
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
            </button>

            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-5 animate-fade-in-up">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-base font-black text-violet-700">
                            {session.userName?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-black text-gray-900">{session.userName}</h1>
                                <Badge variant={sessionStatusBadge(session.isSuspended ? 'SUSPENDED' : session.submittedAt ? 'SUBMITTED' : 'ACTIVE')} label={session.isSuspended ? 'SUSPENDED' : session.submittedAt ? 'SUBMITTED' : 'ACTIVE'} />
                            </div>
                            <p className="text-gray-500 text-sm">{session.examTitle}</p>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Session #{session.id} · Started {new Date(session.startedAt).toLocaleString()}</p>
                    <div className="flex gap-2">
                        {!session.isSuspended && !session.submittedAt && (
                            <Button variant="danger" size="sm" onClick={() => setConfirmSuspend(true)}>Suspend</Button>
                        )}
                    </div>
                </div>

                {/* Summary stats */}
                {summary && (
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Tab Switches', value: summary.tabSwitchCount ?? 0, icon: '⇄' },
                            { label: 'Fullscreen Exits', value: summary.fullscreenExitCount ?? 0, icon: '⛶' },
                            { label: 'Copy/Paste', value: summary.copyPasteCount ?? 0, icon: '⎘' },
                            { label: 'Total Flags', value: (summary.tabSwitchCount ?? 0) + (summary.fullscreenExitCount ?? 0) + (summary.copyPasteCount ?? 0), icon: '⚑' },
                        ].map(stat => (
                            <div key={stat.label} className={`rounded-xl p-3 ${stat.value > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-100'}`}>
                                <p className="text-xs text-gray-500">{stat.label}</p>
                                <p className={`text-2xl font-black mt-0.5 ${stat.value > 0 ? 'text-red-600' : 'text-gray-300'}`}>{stat.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-5">
                {(['events', 'report'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px capitalize transition-all duration-200 ${tab === t ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-violet-600 hover:border-violet-200'
                            }`}>{t}</button>
                ))}
            </div>

            {tab === 'events' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden animate-fade-in">
                    {events.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 text-sm">No violation events.</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Type', 'Timestamp', 'Details'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {events.map((ev, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">{ev.eventType}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600">{ev.description ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {tab === 'report' && report && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 animate-fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                        <StatBox label="Score %" value={report.session?.score != null ? `${report.session.score}` : '—'} />
                        <StatBox label="Marks" value={report.session?.score != null && report.session?.totalMarks != null ? `${report.session.score}/${report.session.totalMarks}` : '—'} />
                        <StatBox label="Answers" value={`${report.answers?.length ?? 0}`} />
                    </div>
                    {report.answers && report.answers.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 mb-3">Answer Review</h3>
                            <div className="space-y-2">
                                {report.answers.map((a, i) => (
                                    <div key={i} className="p-3 rounded-xl border border-gray-100 bg-gray-50 text-sm">
                                        <p className="text-gray-400 text-xs mb-0.5">Q{i + 1} (ID: {a.questionId?.slice(0, 8)}…)</p>
                                        <p className="text-gray-800">
                                            Answer: <span className="font-semibold text-violet-700">{a.selectedAnswer ?? '—'}</span>
                                            {a.marksAwarded != null && <span className="ml-2 text-gray-400 text-xs">({a.marksAwarded} marks)</span>}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Suspend dialog */}
            {confirmSuspend && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setConfirmSuspend(false)} />
                    <div className="relative bg-white rounded-2xl shadow-violet-lg p-6 max-w-sm w-full z-10 animate-scale-in border border-violet-100 overflow-hidden">
                        <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-red-500 to-rose-500" />
                        <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Suspend Session</h3>
                        <p className="text-sm text-gray-500 mb-4">This will terminate the student's active exam session.</p>
                        <label className="label">Reason *</label>
                        <textarea className="input resize-none mb-4" rows={3} value={suspendReason}
                            onChange={e => setSuspendReason(e.target.value)} placeholder="Enter suspension reason…" />
                        <div className="flex gap-3 justify-end">
                            <Button variant="secondary" size="sm" onClick={() => setConfirmSuspend(false)}>Cancel</Button>
                            <Button variant="danger" size="sm" loading={suspending} onClick={handleSuspend}>Suspend</Button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
)
