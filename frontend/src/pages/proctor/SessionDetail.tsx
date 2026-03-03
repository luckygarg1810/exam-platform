import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, sessionStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { getSession, reinstateSession } from '../../api/sessions'
import { getProctoringEvents, getViolationSummary, suspendSession, addFlag, clearFlag, addNote } from '../../api/proctoring'
import { ExamSession, ViolationEvent, ViolationSummary } from '../../types'
import toast from 'react-hot-toast'

export const SessionDetail: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>()
    const navigate = useNavigate()
    const sid = sessionId!

    const [session, setSession] = useState<ExamSession | null>(null)
    const [events, setEvents] = useState<ViolationEvent[]>([])
    const [summary, setSummary] = useState<ViolationSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [note, setNote] = useState('')
    const [suspendReason, setSuspendReason] = useState('')
    const [showSuspend, setShowSuspend] = useState(false)
    const [saving, setSaving] = useState(false)

    const load = async () => {
        try {
            const [sess, evtsPage, sum] = await Promise.all([
                getSession(sid), getProctoringEvents(sid), getViolationSummary(sid),
            ])
            setSession(sess); setEvents(evtsPage.content ?? []); setSummary(sum)
        } catch { toast.error('Failed to load session') }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [sid]) // eslint-disable-line

    const handleAddNote = async () => {
        if (!note.trim()) return
        setSaving(true)
        try { await addNote(sid, note); toast.success('Note added'); setNote('') }
        catch (e: any) { toast.error(e.response?.data?.message || 'Failed') }
        finally { setSaving(false) }
    }

    const handleFlag = async () => {
        setSaving(true)
        try { await addFlag(sid, 'MANUAL_FLAG', 'Flagged by proctor'); toast.success('Flag added'); load() }
        catch (e: any) { toast.error(e.response?.data?.message || 'Failed') }
        finally { setSaving(false) }
    }

    const handleClearFlag = async () => {
        setSaving(true)
        try { await clearFlag(sid); toast.success('Flag cleared'); load() }
        catch (e: any) { toast.error(e.response?.data?.message || 'Failed') }
        finally { setSaving(false) }
    }

    const handleSuspend = async () => {
        if (!suspendReason.trim()) { toast.error('Enter a reason'); return }
        setSaving(true)
        try {
            await suspendSession(sid, suspendReason)
            toast.success('Session suspended'); setShowSuspend(false); setSuspendReason(''); load()
        } catch (e: any) { toast.error(e.response?.data?.message || 'Failed') }
        finally { setSaving(false) }
    }

    const handleReinstate = async () => {
        setSaving(true)
        try { await reinstateSession(sid); toast.success('Session reinstated'); load() }
        catch (e: any) { toast.error(e.response?.data?.message || 'Failed') }
        finally { setSaving(false) }
    }

    if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size="lg" /></div></Layout>
    if (!session) return <Layout><p className="text-gray-500">Session not found.</p></Layout>

    const totalViolations = (summary?.tabSwitchCount ?? 0) + (summary?.fullscreenExitCount ?? 0) + (summary?.copyPasteCount ?? 0)

    return (
        <Layout>
            <button onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-semibold mb-5 group">
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
            </button>

            {/* Session header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-5 animate-fade-in-up">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-lg font-black text-violet-700">
                            {session.userName?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-black text-gray-900">{session.userName}</h1>
                                <Badge variant={sessionStatusBadge(session.isSuspended ? 'SUSPENDED' : session.submittedAt ? 'SUBMITTED' : 'ACTIVE')} label={session.isSuspended ? 'SUSPENDED' : session.submittedAt ? 'SUBMITTED' : 'ACTIVE'} />
                                {summary?.proctorFlag && <Badge variant="red" label="FLAGGED" />}
                            </div>
                            <p className="text-gray-500 text-sm">{session.examTitle}</p>
                            <p className="text-gray-400 text-xs mt-0.5">Session #{session.id} &middot; Started {new Date(session.startedAt).toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {!summary?.proctorFlag ? (
                            <Button size="sm" variant="secondary" onClick={handleFlag} loading={saving}>Add Flag</Button>
                        ) : (
                            <Button size="sm" variant="ghost" onClick={handleClearFlag} loading={saving}>Clear Flag</Button>
                        )}
                        {!session.isSuspended && !session.submittedAt && (
                            <Button size="sm" variant="danger" onClick={() => setShowSuspend(true)}>Suspend</Button>
                        )}
                        {session.isSuspended && (
                            <Button size="sm" variant="success" onClick={handleReinstate} loading={saving}>Reinstate</Button>
                        )}
                    </div>
                </div>

                {/* Violation summary chips */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Tab Switches', value: summary.tabSwitchCount ?? 0 },
                            { label: 'Fullscreen Exits', value: summary.fullscreenExitCount ?? 0 },
                            { label: 'Copy/Paste', value: summary.copyPasteCount ?? 0 },
                            { label: 'Total', value: totalViolations },
                        ].map(s => (
                            <div key={s.label} className={`rounded-xl p-3 border ${s.value > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                                <p className="text-xs text-gray-500">{s.label}</p>
                                <p className={`text-2xl font-black mt-0.5 ${s.value > 0 ? 'text-red-600' : 'text-gray-300'}`}>{s.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
                {/* Violation events */}
                <div>
                    <h2 className="section-title mb-3">Violation Events ({events.length})</h2>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden max-h-96 overflow-y-auto scrollbar-violet">
                        {events.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-gray-400 text-sm">No violations.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {events.map((ev, i) => (
                                    <div key={i} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">{ev.eventType}</span>
                                            <span className="text-xs text-gray-400">
                                                {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : '—'}
                                            </span>
                                        </div>
                                        {ev.description && <p className="text-xs text-gray-500 mt-1">{ev.description}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <h2 className="section-title mb-3">Add Note</h2>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
                        <textarea className="input resize-none mb-3" rows={4}
                            value={note} onChange={e => setNote(e.target.value)}
                            placeholder="Enter a note about this session…"
                        />
                        <Button size="sm" onClick={handleAddNote} loading={saving} disabled={!note.trim()}>
                            Save Note
                        </Button>

                        {summary?.proctorNote && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Previous Note</h3>
                                <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3">{summary.proctorNote}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Suspend modal */}
            {showSuspend && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setShowSuspend(false)} />
                    <div className="relative bg-white rounded-2xl shadow-violet-lg p-6 max-w-sm w-full z-10 animate-scale-in border border-violet-100 overflow-hidden">
                        <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-red-500 to-rose-500" />
                        <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Suspend Session</h3>
                        <p className="text-sm text-gray-500 mb-4">This will end the student's exam session.</p>
                        <label className="label">Reason *</label>
                        <textarea className="input resize-none mb-4" rows={3} value={suspendReason}
                            onChange={e => setSuspendReason(e.target.value)} placeholder="Reason for suspension…" />
                        <div className="flex gap-3 justify-end">
                            <Button variant="secondary" size="sm" onClick={() => setShowSuspend(false)}>Cancel</Button>
                            <Button variant="danger" size="sm" loading={saving} onClick={handleSuspend}>Suspend</Button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
