import React, { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { getProctorsForExam, assignProctor, unassignProctor } from '../../api/proctorAssignment'
import { ExamProctorAssignment } from '../../types'
import toast from 'react-hot-toast'

export const ManageProctors: React.FC<{ examId: string; isCompleted?: boolean }> = ({ examId, isCompleted = false }) => {
    const [proctors, setProctors] = useState<ExamProctorAssignment[]>([])
    const [loading, setLoading] = useState(true)
    const [proctorId, setProctorId] = useState('')
    const [saving, setSaving] = useState(false)
    const [removing, setRemoving] = useState<ExamProctorAssignment | null>(null)

    const load = () =>
        getProctorsForExam(examId).then(setProctors).catch(() => toast.error('Failed to load proctors')).finally(() => setLoading(false))

    useEffect(() => { load() }, [examId]) // eslint-disable-line

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!proctorId.trim()) return
        setSaving(true)
        try {
            await assignProctor(examId, proctorId)
            toast.success('Proctor assigned')
            setProctorId(''); load()
        } catch (err: any) { toast.error(err.response?.data?.message || 'Assignment failed') }
        finally { setSaving(false) }
    }

    const handleRemove = async () => {
        if (!removing) return
        try {
            await unassignProctor(examId, removing.proctorId)
            toast.success('Proctor removed')
            setRemoving(null); load()
        } catch (err: any) { toast.error(err.response?.data?.message || 'Failed') }
    }

    return (
        <div>
            {isCompleted && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold rounded-xl px-4 py-3 mb-5">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Exam is completed — proctor assignments are locked.
                </div>
            )}
            <form onSubmit={handleAssign} className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 mb-5">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Assign Proctor</h3>
                </div>
                <div className="flex gap-2">
                    <input type="number" min={1} required className="input" value={proctorId} disabled={isCompleted}
                        onChange={e => setProctorId(e.target.value)} placeholder="Proctor User ID" />
                    <Button type="submit" loading={saving} size="sm" disabled={isCompleted}>Assign</Button>
                </div>
            </form>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-900">Assigned Proctors <span className="text-violet-600">({proctors.length})</span></h3>
                </div>
                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : proctors.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        </div>
                        <p className="text-sm text-gray-400">No proctors assigned.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Name', 'Email', 'Assigned At', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {proctors.map(p => (
                                <tr key={p.proctorId} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{p.proctorName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{p.proctorEmail}</td>
                                    <td className="px-4 py-3 text-xs text-gray-400">
                                        {p.assignedAt ? new Date(p.assignedAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {!isCompleted && (
                                            <button onClick={() => setRemoving(p)}
                                                className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">Remove</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ConfirmDialog
                open={!!removing}
                title="Remove Proctor"
                message={`Remove ${removing?.proctorName ?? 'this proctor'} from the exam?`}
                confirmLabel="Remove"
                onConfirm={handleRemove}
                onCancel={() => setRemoving(null)}
            />
        </div>
    )
}
