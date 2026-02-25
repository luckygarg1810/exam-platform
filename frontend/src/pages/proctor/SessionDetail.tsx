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
            <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
                ← Back
            </button>

            {/* Session header */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-lg font-bold text-gray-900">{session.userName}</h1>
                            <Badge variant={sessionStatusBadge(session.isSuspended ? 'SUSPENDED' : session.submittedAt ? 'SUBMITTED' : 'ACTIVE')} label={session.isSuspended ? 'SUSPENDED' : session.submittedAt ? 'SUBMITTED' : 'ACTIVE'} />
                            {summary?.proctorFlag && <Badge variant="red" label="FLAGGED" />}
                        </div>
                        <p className="text-sm text-gray-500">{session.examTitle}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Session #{session.id} · Started {new Date(session.startedAt).toLocaleString()}
                        </p>
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

                {/* Violation summary */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Tab Switches', value: summary.tabSwitchCount ?? 0 },
                            { label: 'Fullscreen Exits', value: summary.fullscreenExitCount ?? 0 },
                            { label: 'Copy/Paste', value: summary.copyPasteCount ?? 0 },
                            { label: 'Total', value: totalViolations },
                        ].map(s => (
                            <div key={s.label} className={`rounded-lg p-3 ${s.value > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                                <p className="text-xs text-gray-500">{s.label}</p>
                                <p className={`text-xl font-bold ${s.value > 0 ? 'text-red-600' : 'text-gray-400'}`}>{s.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
                {/* Violation events */}
                <div>
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Violation Events ({events.length})</h2>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-h-96 overflow-y-auto">
                        {events.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-8">No violations.</p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {events.map((ev, i) => (
                                    <div key={i} className="px-4 py-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-red-600">{ev.eventType}</span>
                                            <span className="text-xs text-gray-400">
                                                {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : '—'}
                                            </span>
                                        </div>
                                        {ev.description && <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Notes + proctor notes */}
                <div>
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Add Note</h2>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <textarea
                            className="input resize-none mb-3" rows={4}
                            value={note} onChange={e => setNote(e.target.value)}
                            placeholder="Enter a note about this session…"
                        />
                        <Button size="sm" onClick={handleAddNote} loading={saving} disabled={!note.trim()}>
                            Save Note
                        </Button>

                        {summary?.proctorNote && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Previous Note</h3>
                                <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">{summary.proctorNote}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Suspend modal */}
            {showSuspend && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowSuspend(false)} />
                    <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 z-10">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Suspend Session</h3>
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
