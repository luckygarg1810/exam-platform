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
            <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
                ← Back
            </button>

            {/* Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-lg font-bold text-gray-900">{session.userName}</h1>
                            <Badge variant={sessionStatusBadge(session.isSuspended ? 'SUSPENDED' : session.submittedAt ? 'SUBMITTED' : 'ACTIVE')} label={session.isSuspended ? 'SUSPENDED' : session.submittedAt ? 'SUBMITTED' : 'ACTIVE'} />
                        </div>
                        <p className="text-sm text-gray-500">{session.examTitle}</p>
                        <p className="text-xs text-gray-400 mt-1">Session #{session.id} · Started {new Date(session.startedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                        {!session.isSuspended && !session.submittedAt && (
                            <Button variant="danger" size="sm" onClick={() => setConfirmSuspend(true)}>Suspend</Button>
                        )}
                    </div>
                </div>

                {/* Summary stats */}
                {summary && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Tab Switches', value: summary.tabSwitchCount ?? 0 },
                            { label: 'Fullscreen Exits', value: summary.fullscreenExitCount ?? 0 },
                            { label: 'Copy/Paste', value: summary.copyPasteCount ?? 0 },
                            { label: 'Total Flags', value: (summary.tabSwitchCount ?? 0) + (summary.fullscreenExitCount ?? 0) + (summary.copyPasteCount ?? 0) },
                        ].map(stat => (
                            <div key={stat.label} className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500">{stat.label}</p>
                                <p className={`text-xl font-bold ${stat.value > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stat.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-5">
                {(['events', 'report'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}>{t}</button>
                ))}
            </div>

            {tab === 'events' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {events.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">No violation events.</p>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Type', 'Timestamp', 'Details'].map(h => (
                                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {events.map((ev, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-4 py-2">
                                            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">{ev.eventType}</span>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500">
                                            {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-600">{ev.description ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {tab === 'report' && report && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                        <StatBox label="Score" value={report.session?.score != null ? `${report.session.score}` : '—'} />
                        <StatBox label="Marks" value={report.session?.score != null && report.session?.totalMarks != null ? `${report.session.score}/${report.session.totalMarks}` : '—'} />
                        <StatBox label="Answers" value={`${report.answers?.length ?? 0}`} />
                    </div>
                    {report.answers && report.answers.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Answer Review</h3>
                            <div className="space-y-2">
                                {report.answers.map((a, i) => (
                                    <div key={i} className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                                        <p className="text-gray-500 text-xs mb-0.5">Q{i + 1} (ID: {a.questionId?.slice(0, 8)}…)</p>
                                        <p className="text-gray-800">
                                            Answer: <span className="font-medium">{a.selectedAnswer ?? '—'}</span>
                                            {a.marksAwarded != null && <span className="ml-2 text-gray-500 text-xs">({a.marksAwarded} marks)</span>}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmSuspend(false)} />
                    <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 z-10">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Suspend Session</h3>
                        <label className="label">Reason</label>
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
