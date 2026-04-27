import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { getExam } from '../../api/exams'
import { Exam } from '../../types'
import toast from 'react-hot-toast'

/**
 * TeacherExamManage - Manage exam created by this teacher
 * This includes editing questions, assigning invigilators, and viewing enrollments
 */
export const TeacherExamManage: React.FC = () => {
    const { examId } = useParams<{ examId: string }>()
    const navigate = useNavigate()
    const [exam, setExam] = useState<Exam | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'details' | 'questions' | 'invigilators' | 'enrollments'>('details')

    useEffect(() => {
        loadExam()
    }, [])

    const loadExam = async () => {
        try {
            if (!examId) return
            const data = await getExam(examId)
            setExam(data)
        } catch (err) {
            toast.error('Failed to load exam')
            navigate('/teacher')
        } finally {
            setLoading(false)
        }
    }

    if (loading || !exam) {
        return (
            <Layout>
                <div className="flex justify-center py-20">
                    <div className="text-center">
                        <Spinner size="lg" />
                        <p className="text-gray-400 text-sm mt-3">Loading exam...</p>
                    </div>
                </div>
            </Layout>
        )
    }

    const isDraft = exam.status === 'DRAFT'

    return (
        <Layout>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/teacher')}
                    className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-semibold group"
                >
                    <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
            </div>

            {/* Exam header card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">{exam.title}</h1>
                        <p className="text-gray-600 text-sm mb-4">{exam.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {exam.durationMinutes} minutes
                            </span>
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                {exam.totalMarks} marks
                            </span>
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Pass: {exam.passingMarks} marks
                            </span>
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                                </svg>
                                {exam.questionCount || 0} questions
                            </span>
                        </div>
                    </div>
                    <Badge variant="purple" label={exam.status} />
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <div className="flex border-b border-gray-100">
                    {[
                        { id: 'details', label: 'Details', icon: '📋' },
                        { id: 'questions', label: 'Questions', icon: '❓' },
                        { id: 'invigilators', label: 'Invigilators', icon: '👥' },
                        { id: 'enrollments', label: 'Enrollments', icon: '👨‍🎓' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`px-6 py-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-violet-600 text-violet-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {activeTab === 'details' && <DetailsTab exam={exam} isDraft={isDraft} />}
                    {activeTab === 'questions' && <QuestionsTab examId={exam.id} isDraft={isDraft} questionCount={exam.questionCount || 0} />}
                    {activeTab === 'invigilators' && <InvigilatorsTab examId={exam.id} isDraft={isDraft} />}
                    {activeTab === 'enrollments' && <EnrollmentsTab examId={exam.id} isDraft={isDraft} />}
                </div>
            </div>
        </Layout>
    )
}

// ─── Details Tab ───────────────────────────────────────────────────────────────
const DetailsTab: React.FC<{ exam: Exam; isDraft: boolean }> = ({ exam, isDraft }) => {
    return (
        <div className="max-w-2xl">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                    <p className="text-gray-900">{exam.title}</p>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                    <p className="text-gray-900">{exam.description || '—'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Duration</label>
                        <p className="text-gray-900">{exam.durationMinutes} minutes</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Total Marks</label>
                        <p className="text-gray-900">{exam.totalMarks}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Passing Marks</label>
                        <p className="text-gray-900">{exam.passingMarks}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                        <p className="text-gray-900">{exam.status}</p>
                    </div>
                </div>
                {!isDraft && (
                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        This exam is {exam.status.toLowerCase()}. Only exam details can be viewed.
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Questions Tab ──────────────────────────────────────────────────────────────
const QuestionsTab: React.FC<{ examId: string; isDraft: boolean; questionCount: number }> = ({ examId, isDraft, questionCount }) => {
    return (
        <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-sm text-gray-600">Total questions</p>
                    <p className="text-3xl font-bold text-gray-900">{questionCount}</p>
                </div>
                {isDraft && (
                    <Button icon={<span>➕</span>}>Add Question</Button>
                )}
            </div>

            {questionCount === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                        <span className="text-2xl">❓</span>
                    </div>
                    <p className="text-gray-600 mb-4">No questions yet.</p>
                    {isDraft && <Button>Add Your First Question</Button>}
                </div>
            ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {Array.from({ length: questionCount }).map((_, i) => (
                        <div key={i} className="p-4 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-gray-900">Question {i + 1}</p>
                                <p className="text-sm text-gray-600">Marks: 1</p>
                            </div>
                            {isDraft && (
                                <div className="flex gap-2">
                                    <button className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">Edit</button>
                                    <button className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded">Delete</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!isDraft && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    This exam is {isDraft ? 'draft' : 'published'}. Questions cannot be modified.
                </div>
            )}
        </div>
    )
}

// ─── Invigilators Tab ───────────────────────────────────────────────────────────
const InvigilatorsTab: React.FC<{ examId: string; isDraft: boolean }> = ({ examId, isDraft }) => {
    const [invigilators] = useState([])

    return (
        <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-sm text-gray-600">Assigned invigilators</p>
                    <p className="text-3xl font-bold text-gray-900">{invigilators.length}</p>
                </div>
                <Button icon={<span>➕</span>}>Assign Invigilator</Button>
            </div>

            {invigilators.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                        <span className="text-2xl">👥</span>
                    </div>
                    <p className="text-gray-600 mb-4">No invigilators assigned yet.</p>
                    <Button>Assign First Invigilator</Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {invigilators.map((inv: any) => (
                        <div key={inv.id} className="p-4 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-gray-900">{inv.name}</p>
                                <p className="text-sm text-gray-600">{inv.email}</p>
                            </div>
                            <button className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded">Remove</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Enrollments Tab ────────────────────────────────────────────────────────────
const EnrollmentsTab: React.FC<{ examId: string; isDraft: boolean }> = ({ examId, isDraft }) => {
    const [enrollments] = useState([])

    return (
        <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-sm text-gray-600">Enrolled students</p>
                    <p className="text-3xl font-bold text-gray-900">{enrollments.length}</p>
                </div>
                <Button icon={<span>➕</span>}>Add Students</Button>
            </div>

            {enrollments.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                        <span className="text-2xl">👨‍🎓</span>
                    </div>
                    <p className="text-gray-600 mb-4">No students enrolled yet.</p>
                    <Button>Enroll First Student</Button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {enrollments.map((enr: any) => (
                                <tr key={enr.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-3 px-4">{enr.name}</td>
                                    <td className="py-3 px-4">{enr.email}</td>
                                    <td className="py-3 px-4">
                                        <Badge variant="green" label="Enrolled" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
