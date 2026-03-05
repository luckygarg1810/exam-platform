import React, { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { listEnrollments, enrollStudent, bulkEnroll, unenrollStudent } from '../../api/enrollment'
import { Enrollment } from '../../types'
import toast from 'react-hot-toast'

export const ManageEnrollments: React.FC<{ examId: string; isCompleted?: boolean }> = ({ examId, isCompleted = false }) => {
    const [enrollments, setEnrollments] = useState<Enrollment[]>([])
    const [loading, setLoading] = useState(true)
    const [studentRoll, setStudentRoll] = useState('')
    const [bulkRolls, setBulkRolls] = useState('')
    const [saving, setSaving] = useState(false)
    const [unenrolling, setUnenrolling] = useState<Enrollment | null>(null)

    const load = () =>
        listEnrollments(examId).then(p => setEnrollments(p.content ?? [])).catch(() => toast.error('Failed to load enrollments')).finally(() => setLoading(false))

    useEffect(() => { load() }, [examId]) // eslint-disable-line

    const handleEnroll = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!studentRoll.trim()) return
        setSaving(true)
        try {
            await enrollStudent(examId, studentRoll.trim())
            toast.success('Student enrolled')
            setStudentRoll(''); load()
        } catch (err: any) { toast.error(err.response?.data?.message || 'Enrollment failed') }
        finally { setSaving(false) }
    }

    const handleBulk = async (e: React.FormEvent) => {
        e.preventDefault()
        const rolls = bulkRolls.split(/[,\s\n]+/).map(s => s.trim()).filter(Boolean)
        if (!rolls.length) { toast.error('Enter at least one roll number'); return }
        setSaving(true)
        try {
            const result = await bulkEnroll(examId, rolls)
            toast.success(`Enrolled ${result.successCount} · Failed: ${result.failureCount}`)
            if (result.errors?.length) result.errors.forEach(e => toast.error(e, { duration: 5000 }))
            setBulkRolls(''); load()
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
            {isCompleted && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold rounded-xl px-4 py-3 mb-5">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Exam is completed — enrollment changes are disabled.
                </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {/* Single enroll */}
                <form onSubmit={handleEnroll} className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900">Enroll Single Student</h3>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" required className="input" value={studentRoll} disabled={isCompleted}
                            onChange={e => setStudentRoll(e.target.value)} placeholder="University Roll No. (e.g. 2021CS001)" />
                        <Button type="submit" loading={saving} size="sm" disabled={isCompleted}>Enroll</Button>
                    </div>
                </form>

                {/* Bulk enroll */}
                <form onSubmit={handleBulk} className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900">Bulk Enroll</h3>
                    </div>
                    <textarea className="input mb-3 w-full" rows={3} value={bulkRolls} disabled={isCompleted}
                        onChange={e => setBulkRolls(e.target.value)}
                        placeholder="2021CS001, 2021CS002, 2021CS003 (comma or newline separated)" />
                    <Button type="submit" loading={saving} size="sm" disabled={isCompleted}>Bulk Enroll</Button>
                </form>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-900">Enrolled Students <span className="text-violet-600">({enrollments.length})</span></h3>
                </div>
                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : enrollments.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <p className="text-sm text-gray-400">No students enrolled yet.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Roll No.', 'Student', 'Email', 'Enrolled At', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {enrollments.map(en => (
                                <tr key={en.userId} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-mono font-bold text-violet-700">{en.universityRoll ?? '—'}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{en.userName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{en.userEmail ?? '—'}</td>
                                    <td className="px-4 py-3 text-xs text-gray-400">
                                        {en.enrolledAt ? new Date(en.enrolledAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {!isCompleted && (
                                            <button onClick={() => setUnenrolling(en)}
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
