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

export const ProctorDashboard: React.FC = () => {
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
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Proctor Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">Welcome, {user?.name}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                    { label: 'Active Exams', value: active.length, color: 'text-green-600' },
                    { label: 'Upcoming', value: upcoming.length, color: 'text-blue-600' },
                    { label: 'Completed', value: past.length, color: 'text-gray-500' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">{s.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : exams.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
                    <p className="text-gray-400">No exams assigned to you yet.</p>
                </div>
            ) : (
                <div>
                    {active.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">Active Now</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {active.map(exam => <AssignedExamCard key={exam.id} exam={exam} onInvigulate={() => navigate(`/proctor/exams/${exam.id}/invigulate`)} />)}
                            </div>
                        </div>
                    )}
                    {upcoming.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {upcoming.map(exam => <AssignedExamCard key={exam.id} exam={exam} />)}
                            </div>
                        </div>
                    )}
                    {past.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Completed</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {past.map(exam => <AssignedExamCard key={exam.id} exam={exam} />)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    )
}

const AssignedExamCard: React.FC<{ exam: Exam; onInvigulate?: () => void }> = ({ exam, onInvigulate }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug pr-2">{exam.title}</h3>
            <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{exam.description}</p>
        <div className="flex gap-3 text-xs text-gray-500 mb-3">
            <span>{exam.durationMinutes} min</span>
            <span>·</span>
            <span>{exam.totalMarks} marks</span>
        </div>
        {exam.startTime && <p className="text-xs text-blue-600 mb-3">{new Date(exam.startTime).toLocaleString()}</p>}
        {onInvigulate && (
            <Button size="sm" onClick={onInvigulate} className="w-full justify-center">
                Invigulate
            </Button>
        )}
    </div>
)
