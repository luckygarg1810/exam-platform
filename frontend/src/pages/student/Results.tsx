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
            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-6 animate-fade-in-up">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">My Results</h1>
                            <p className="text-gray-500 text-sm mt-0.5">{history.length} exam{history.length !== 1 ? 's' : ''} completed</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/student')}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-semibold bg-gray-50 hover:bg-gray-100 px-3.5 py-1.5 rounded-xl transition-all border border-gray-200">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        Dashboard
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : history.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-card text-center py-16">
                    <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <p className="text-gray-400">No completed exams yet.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden animate-fade-in">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Exam', 'Submitted', 'Score', 'Marks', 'Status'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {history.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-3 text-sm font-semibold text-gray-900">{row.examTitle}</td>
                                    <td className="px-5 py-3 text-sm text-gray-500">
                                        {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}
                                    </td>
                                    <td className="px-5 py-3">
                                        {row.scorePercent != null ? (
                                            <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg ${row.scorePercent >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {row.scorePercent.toFixed(1)}%
                                            </span>
                                        ) : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-gray-500">
                                        {row.score != null && row.totalMarks != null
                                            ? `${row.score} / ${row.totalMarks}`
                                            : '—'}
                                    </td>
                                    <td className="px-5 py-3">
                                        {row.isSuspended
                                            ? <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">⚠ Suspended</span>
                                            : <span className="text-gray-400 text-sm">—</span>}
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
