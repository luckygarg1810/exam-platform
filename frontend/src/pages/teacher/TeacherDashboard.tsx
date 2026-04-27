import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, examStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { getMyAssignedExams } from '../../api/exams'
import { Exam } from '../../types'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

export const TeacherDashboard: React.FC = () => {
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const [exams, setExams] = useState<Exam[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getMyAssignedExams()
            .then(data => setExams(data))
            .catch(() => toast.error('Failed to load assigned exams'))
            .finally(() => setLoading(false))
    }, [])

    const active = exams.filter(e => e.status === 'ONGOING')
    const upcoming = exams.filter(e => e.status === 'PUBLISHED' || e.status === 'DRAFT')
    const past = exams.filter(e => e.status === 'COMPLETED')

    return (
        <Layout>
            {/* Hero banner */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-6 animate-fade-in-up">
                <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center text-xl font-black text-violet-700">
                        {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900">Teacher Dashboard</h1>
                        <p className="text-gray-500 text-sm">Welcome, {user?.name}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Active Exams', value: active.length, prominent: active.length > 0 },
                        { label: 'Upcoming', value: upcoming.length, prominent: false },
                        { label: 'Completed', value: past.length, prominent: false },
                    ].map(s => (
                        <div key={s.label} className={`rounded-xl p-3 border ${s.prominent ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                            <p className="text-xs font-medium opacity-70">{s.label}</p>
                            <p className={`text-2xl font-black mt-0.5 ${s.prominent ? 'text-emerald-700' : 'text-gray-700'}`}>{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : exams.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-card text-center py-16">
                    <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <p className="text-gray-400">No exams assigned to you yet.</p>
                </div>
            ) : (
                <div className="animate-fade-in">
                    {active.length > 0 && (
                        <div className="mb-6">
                            <h2 className="section-title mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Active Now
                            </h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {active.map((exam, i) => <AssignedExamCard key={exam.id} exam={exam} index={i} onInvigulate={() => navigate(`/teacher/exams/${exam.id}/invigulate`)} />)}
                            </div>
                        </div>
                    )}
                    {upcoming.length > 0 && (
                        <div className="mb-6">
                            <h2 className="section-title mb-3">Upcoming</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {upcoming.map((exam, i) => <AssignedExamCard key={exam.id} exam={exam} index={i} />)}
                            </div>
                        </div>
                    )}
                    {past.length > 0 && (
                        <div>
                            <h2 className="section-title mb-3">Completed</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {past.map((exam, i) => <AssignedExamCard key={exam.id} exam={exam} index={i} />)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    )
}

const AssignedExamCard: React.FC<{ exam: Exam; index?: number; onInvigulate?: () => void }> = ({ exam, index = 0, onInvigulate }) => {
    const isActive = exam.status === 'ONGOING'
    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 overflow-hidden stagger-${Math.min(index + 1, 6)}`}>
            <div className={`h-1.5 ${isActive ? 'bg-gradient-to-r from-emerald-400 to-green-500' : exam.status === 'COMPLETED' ? 'bg-gray-200' : 'bg-gradient-to-r from-violet-500 to-purple-500'}`} />
            <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug flex-1 pr-2">{exam.title}</h3>
                    <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{exam.description}</p>
                <div className="flex gap-3 text-xs text-gray-400 font-medium mb-3">
                    <span>{exam.durationMinutes} min</span>
                    <span>·</span>
                    <span>{exam.totalMarks} marks</span>
                </div>
                {exam.startTime && <p className="text-xs text-violet-600 font-semibold mb-3">{new Date(exam.startTime).toLocaleString()}</p>}
                {onInvigulate && (
                    <Button size="sm" onClick={onInvigulate} className="w-full justify-center">
                        Invigulate
                    </Button>
                )}
            </div>
        </div>
    )
}
