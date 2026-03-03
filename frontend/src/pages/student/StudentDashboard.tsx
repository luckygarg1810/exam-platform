import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, examStatusBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { listExams } from '../../api/exams'
import { getStudentHistory } from '../../api/reports'
import { Exam, StudentHistoryRow } from '../../types'
import toast from 'react-hot-toast'

export const StudentDashboard: React.FC = () => {
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const [exams, setExams] = useState<Exam[]>([])
    const [history, setHistory] = useState<StudentHistoryRow[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'available' | 'history'>('available')

    useEffect(() => {
        const load = async () => {
            try {
                const [examPage, histPage] = await Promise.all([
                    listExams(0, 50),
                    user ? getStudentHistory(user.id) : Promise.resolve({ content: [] as StudentHistoryRow[], totalElements: 0, totalPages: 0, number: 0, size: 0, first: true, last: true }),
                ])
                setExams(examPage.content)
                setHistory(histPage.content)
            } catch {
                toast.error('Failed to load dashboard')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [user])

    const upcoming = exams.filter(e => e.status === 'PUBLISHED')
    const ongoing = exams.filter(e => e.status === 'ONGOING')

    return (
        <Layout>
            {/* Hero welcome banner */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-6 animate-fade-in-up">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm flex-shrink-0">
                        {user?.profilePhotoUrl ? (
                            <img src={user.profilePhotoUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-violet-50 flex items-center justify-center text-2xl font-black text-violet-600">
                                {user?.name?.charAt(0)?.toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
                        <p className="text-gray-500 text-sm mt-0.5">{user?.universityRoll} &middot; {user?.department}</p>
                    </div>
                </div>
                {/* Stats chips */}
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Ongoing', value: ongoing.length, bg: 'bg-emerald-50 border border-emerald-200 text-emerald-700' },
                        { label: 'Upcoming', value: upcoming.length, bg: 'bg-violet-50 border border-violet-200 text-violet-700' },
                        { label: 'Completed', value: history.length, bg: 'bg-gray-50 border border-gray-200 text-gray-700' },
                        {
                            label: 'Avg Score',
                            value: history.length
                                ? `${(history.reduce((s, h) => s + (h.scorePercent ?? 0), 0) / history.length).toFixed(1)}%`
                                : '—',
                            bg: 'bg-gray-50 border border-gray-200 text-gray-700',
                        },
                    ].map(s => (
                        <div key={s.label} className={`rounded-xl p-3 ${s.bg}`}>
                            <p className="text-xs font-medium opacity-70">{s.label}</p>
                            <p className="text-2xl font-black">{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 border border-gray-200 p-1 rounded-xl mb-5 w-fit">
                {(['available', 'history'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${tab === t ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t === 'available' ? 'My Exams' : 'Results'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : tab === 'available' ? (
                <div className="animate-fade-in">
                    {ongoing.length > 0 && (
                        <div className="mb-6">
                            <h2 className="section-title mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Active Now
                            </h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {ongoing.map((exam, i) => <ExamCard key={exam.id} exam={exam} index={i} />)}
                            </div>
                        </div>
                    )}
                    <div>
                        <h2 className="section-title mb-3">Upcoming</h2>
                        {upcoming.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                                <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <p className="text-gray-400 text-sm">No upcoming exams enrolled.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {upcoming.map((exam, i) => <ExamCard key={exam.id} exam={exam} index={i} />)}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden animate-fade-in">
                    {history.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <p className="text-gray-400 text-sm">No completed exams yet.</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Exam', 'Date', 'Score', 'Status'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {history.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.examTitle}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.scorePercent != null
                                                ? <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg ${row.scorePercent >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{row.scorePercent.toFixed(1)}%</span>
                                                : <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="green" label="Completed" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </Layout>
    )
}

const ExamCard: React.FC<{ exam: Exam; index?: number }> = ({ exam, index = 0 }) => {
    const isOngoing = exam.status === 'ONGOING'
    return (
        <Link to={`/student/exams/${exam.id}`}
            className={`block bg-white rounded-2xl border border-violet-100 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 overflow-hidden stagger-${Math.min(index + 1, 6)}`}>
            <div className={`h-1.5 ${isOngoing ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-violet-500 to-purple-500'}`} />
            <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight flex-1 pr-2">{exam.title}</h3>
                    <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{exam.description}</p>
                <div className="flex gap-3 text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {exam.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" /></svg>
                        {exam.totalMarks} marks
                    </span>
                </div>
                {exam.startTime && (
                    <p className="mt-2.5 text-xs text-violet-600 font-semibold">
                        {new Date(exam.startTime).toLocaleString()}
                    </p>
                )}
            </div>
        </Link>
    )
}
