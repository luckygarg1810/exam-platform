import React, { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { listEnrollments, enrollStudent, bulkEnroll, unenrollStudent } from '../../api/enrollment'
import { Enrollment } from '../../types'
import toast from 'react-hot-toast'

export const ManageEnrollments: React.FC<{ examId: string }> = ({ examId }) => {
    const [enrollments, setEnrollments] = useState<Enrollment[]>([])
    const [loading, setLoading] = useState(true)
    const [studentId, setStudentId] = useState('')
    const [bulkIds, setBulkIds] = useState('')
    const [saving, setSaving] = useState(false)
    const [unenrolling, setUnenrolling] = useState<Enrollment | null>(null)

    const load = () =>
        listEnrollments(examId).then(p => setEnrollments(p.content ?? [])).catch(() => toast.error('Failed to load enrollments')).finally(() => setLoading(false))

    useEffect(() => { load() }, [examId]) // eslint-disable-line

    const handleEnroll = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!studentId.trim()) return
        setSaving(true)
        try {
            await enrollStudent(examId, studentId)
            toast.success('Student enrolled')
            setStudentId(''); load()
        } catch (err: any) { toast.error(err.response?.data?.message || 'Enrollment failed') }
        finally { setSaving(false) }
    }

    const handleBulk = async (e: React.FormEvent) => {
        e.preventDefault()
        const ids = bulkIds.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
        if (!ids.length) { toast.error('Enter at least one student ID'); return }
        setSaving(true)
        try {
            const result = await bulkEnroll(examId, ids)
            toast.success(`Enrolled ${result.enrolled} · Errors: ${result.errors?.length ?? 0}`)
            setBulkIds(''); load()
        } catch (err: any) { toast.error(err.response?.data?.message || 'Bulk enrollment failed') }
        finally { setSaving(false) }
    }

    const handleUnenroll = async () => {
        if (!unenrolling) return
        try {
            await unenrollStudent(examId, unenrolling.userId)
            toast.success('Student unenrolled')
            setUnenrolling(null); load()
        } catch (err: any) { toast.error(err.response?.data?.message || 'Failed') }
    }

    return (
        <div>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {/* Single enroll */}
                <form onSubmit={handleEnroll} className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Enroll Single Student</h3>
                    <div className="flex gap-2">
                        <input type="text" required className="input" value={studentId}
                            onChange={e => setStudentId(e.target.value)} placeholder="User UUID" />
                        <Button type="submit" loading={saving} size="sm">Enroll</Button>
                    </div>
                </form>

                {/* Bulk enroll */}
                <form onSubmit={handleBulk} className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Bulk Enroll by Student IDs</h3>
                    <input className="input mb-2" value={bulkIds}
                        onChange={e => setBulkIds(e.target.value)} placeholder="uuid1, uuid2, uuid3 (comma separated)" />
                    <Button type="submit" loading={saving} size="sm">Bulk Enroll</Button>
                </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Enrolled Students ({enrollments.length})</h3>
                </div>
                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : enrollments.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">No students enrolled yet.</p>
                ) : (
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Student', 'Email', 'Enrolled At', ''].map(h => (
                                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {enrollments.map(en => (
                                <tr key={en.userId} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{en.userName}</td>
                                    <td className="px-4 py-2 text-sm text-gray-500">{en.userEmail ?? '—'}</td>
                                    <td className="px-4 py-2 text-xs text-gray-400">
                                        {en.enrolledAt ? new Date(en.enrolledAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-4 py-2">
                                        <button onClick={() => setUnenrolling(en)}
                                            className="text-xs text-red-500 hover:underline">Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ConfirmDialog
                open={!!unenrolling}
                title="Remove Student"
                message={`Remove ${unenrolling?.userName ?? 'this student'} from the exam?`}
                confirmLabel="Remove"
                onConfirm={handleUnenroll}
                onCancel={() => setUnenrolling(null)}
            />
        </div>
    )
}
