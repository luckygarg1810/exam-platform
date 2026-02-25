import React, { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { getProctorsForExam, assignProctor, unassignProctor } from '../../api/proctorAssignment'
import { ExamProctorAssignment } from '../../types'
import toast from 'react-hot-toast'

export const ManageProctors: React.FC<{ examId: string }> = ({ examId }) => {
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
            <form onSubmit={handleAssign} className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Assign Proctor</h3>
                <div className="flex gap-2">
                    <input type="number" min={1} required className="input" value={proctorId}
                        onChange={e => setProctorId(e.target.value)} placeholder="Proctor User ID" />
                    <Button type="submit" loading={saving} size="sm">Assign</Button>
                </div>
            </form>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Assigned Proctors ({proctors.length})</h3>
                </div>
                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : proctors.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">No proctors assigned.</p>
                ) : (
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Name', 'Email', 'Assigned At', ''].map(h => (
                                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {proctors.map(p => (
                                <tr key={p.proctorId} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.proctorName}</td>
                                    <td className="px-4 py-2 text-sm text-gray-500">{p.proctorEmail}</td>
                                    <td className="px-4 py-2 text-xs text-gray-400">
                                        {p.assignedAt ? new Date(p.assignedAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-4 py-2">
                                        <button onClick={() => setRemoving(p)}
                                            className="text-xs text-red-500 hover:underline">Remove</button>
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
