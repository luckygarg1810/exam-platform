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
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
                <p className="text-gray-500 text-sm mt-1">{user?.universityRoll} · {user?.department}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Ongoing', value: ongoing.length, color: 'text-green-600' },
                    { label: 'Upcoming', value: upcoming.length, color: 'text-blue-600' },
                    { label: 'Completed', value: history.length, color: 'text-purple-600' },
                    {
                        label: 'Avg Score',
                        value: history.length ? `${(history.reduce((s, h) => s + (h.score ?? 0), 0) / history.length).toFixed(1)}%` : '—',
                        color: 'text-gray-900',
                    },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">{s.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-5 w-fit">
                {(['available', 'history'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}>
                        {t === 'available' ? 'My Exams' : 'Results'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : tab === 'available' ? (
                <div>
                    {ongoing.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">Active Now</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {ongoing.map(exam => <ExamCard key={exam.id} exam={exam} />)}
                            </div>
                        </div>
                    )}
                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
                        {upcoming.length === 0 ? (
                            <p className="text-gray-400 text-sm py-8 text-center">No upcoming exams enrolled.</p>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {upcoming.map(exam => <ExamCard key={exam.id} exam={exam} />)}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {history.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-12">No completed exams yet.</p>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Exam', 'Date', 'Score', 'Status'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.examTitle}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold">
                                            {row.score != null ? `${row.score}%` : '—'}
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

const ExamCard: React.FC<{ exam: Exam }> = ({ exam }) => (
    <Link to={`/student/exams/${exam.id}`}
        className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{exam.title}</h3>
            <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{exam.description}</p>
        <div className="flex gap-3 text-xs text-gray-500">
            <span>{exam.durationMinutes} min</span>
            <span>·</span>
            <span>{exam.totalMarks} marks</span>
        </div>
        {exam.startTime && (
            <p className="mt-2 text-xs text-blue-600">
                {new Date(exam.startTime).toLocaleString()}
            </p>
        )}
    </Link>
)
