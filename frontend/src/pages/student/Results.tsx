import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { getStudentHistory } from '../../api/reports'
import { StudentHistoryRow } from '../../types'
import toast from 'react-hot-toast'

export const Results: React.FC = () => {
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const [history, setHistory] = useState<StudentHistoryRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) return
        getStudentHistory(user.id)
            .then(p => setHistory(p.content ?? []))
            .catch(() => toast.error('Failed to load results'))
            .finally(() => setLoading(false))
    }, [user])

    return (
        <Layout>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Results</h1>
                <button onClick={() => navigate('/student')} className="text-sm text-gray-500 hover:text-gray-700">
                    ← Dashboard
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : history.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
                    <p className="text-gray-400">No completed exams yet.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Exam', 'Submitted', 'Score', 'Marks', 'Status'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{row.examTitle}</td>
                                    <td className="px-5 py-3 text-sm text-gray-500">
                                        {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-sm font-bold">
                                        {row.scorePercent != null ? (
                                            <span className={row.scorePercent >= 50 ? 'text-green-600' : 'text-red-600'}>
                                                {row.scorePercent.toFixed(1)}%
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-gray-500">
                                        {row.score != null && row.totalMarks != null
                                            ? `${row.score} / ${row.totalMarks}`
                                            : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-sm">
                                        {row.isSuspended
                                            ? <span className="text-red-500 font-medium">⚠ Suspended</span>
                                            : <span className="text-gray-400">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    )
}
