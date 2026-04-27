import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, examStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { getMyAssignedExams, listExams } from '../../api/exams'
import { Exam } from '../../types'
import { useAuthStore } from '../../store/authStore'
import { CreateExamModal } from '../../components/ui/CreateExamModal'
import toast from 'react-hot-toast'

export const TeacherDashboard: React.FC = () => {
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const [assignedExams, setAssignedExams] = useState<Exam[]>([])
    const [createdExams, setCreatedExams] = useState<Exam[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)

    const load = () => {
        setLoading(true)
        Promise.all([
            getMyAssignedExams().then(setAssignedExams),
            listExams(0, 100).then(res => setCreatedExams(res.content))
        ])
            .catch(() => toast.error('Failed to load exams'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        load()
    }, [])

    const active = [...createdExams, ...assignedExams].filter(e => e.status === 'ONGOING')
    const upcoming = [...createdExams, ...assignedExams].filter(e => e.status === 'PUBLISHED' || e.status === 'DRAFT')
    const past = [...createdExams, ...assignedExams].filter(e => e.status === 'COMPLETED')

    // Remove duplicates if the teacher created AND is assigned to the same exam (using Set by ID)
    const uniqueCount = (list: Exam[]) => new Set(list.map(e => e.id)).size

    return (
        <Layout>
            {/* Hero banner */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-6 animate-fade-in-up">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center text-xl font-black text-violet-700">
                            {user?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900">Teacher Dashboard</h1>
                            <p className="text-gray-500 text-sm">Welcome, {user?.name}</p>
                        </div>
                    </div>
                    <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                        + Create Exam
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Active Exams', value: uniqueCount(active), prominent: uniqueCount(active) > 0 },
                        { label: 'Upcoming', value: uniqueCount(upcoming), prominent: false },
                        { label: 'Completed', value: uniqueCount(past), prominent: false },
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
            ) : (
                <div className="animate-fade-in space-y-8">
                    
                    {/* My Created Exams Section */}
                    <section>
                        <h2 className="section-title mb-4 flex items-center gap-2">
                            Exams Created By Me
                        </h2>
                        {createdExams.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 border-dashed text-center py-10">
                                <p className="text-gray-400 text-sm">You haven't created any exams yet.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {createdExams.map((exam, i) => (
                                    <ExamCard 
                                        key={exam.id} 
                                        exam={exam} 
                                        index={i} 
                                        actionLabel="Manage Exam"
                                        onAction={() => navigate(`/teacher/exams/${exam.id}`)} 
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Assigned to Invigilate Section */}
                    <section>
                        <h2 className="section-title mb-4 flex items-center gap-2">
                            Assigned to Invigilate
                        </h2>
                        {assignedExams.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 border-dashed text-center py-10">
                                <p className="text-gray-400 text-sm">No exams assigned to you for invigilation.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {assignedExams.map((exam, i) => (
                                    <ExamCard 
                                        key={exam.id} 
                                        exam={exam} 
                                        index={i} 
                                        actionLabel="Invigilate"
                                        onAction={() => navigate(`/teacher/exams/${exam.id}/invigulate`)} 
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            <CreateExamModal 
                open={showCreateModal} 
                onClose={() => setShowCreateModal(false)} 
                onSuccess={load} 
            />
        </Layout>
    )
}

const ExamCard: React.FC<{ exam: Exam; index?: number; actionLabel?: string; onAction?: () => void }> = ({ exam, index = 0, actionLabel, onAction }) => {
    const isActive = exam.status === 'ONGOING'
    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 overflow-hidden stagger-${Math.min(index + 1, 6)}`}>
            <div className={`h-1.5 ${isActive ? 'bg-gradient-to-r from-emerald-400 to-green-500' : exam.status === 'COMPLETED' ? 'bg-gray-200' : 'bg-gradient-to-r from-violet-500 to-purple-500'}`} />
            <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug flex-1 pr-2">{exam.title}</h3>
                    <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">{exam.description}</p>
                <div className="flex gap-3 text-xs text-gray-400 font-medium mb-3">
                    <span>{exam.durationMinutes} min</span>
                    <span>·</span>
                    <span>{exam.totalMarks} marks</span>
                </div>
                {exam.startTime && <p className="text-xs text-violet-600 font-semibold mb-3">{new Date(exam.startTime).toLocaleString()}</p>}
                
                {onAction && actionLabel && (
                    <Button size="sm" onClick={onAction} className="w-full justify-center mt-auto">
                        {actionLabel}
                    </Button>
                )}
            </div>
        </div>
    )
}
