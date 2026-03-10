import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, examStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { getExam, publishExam, deleteExam } from '../../api/exams'
import { Exam } from '../../types'
import { QuestionManager } from './QuestionManager'
import { ManageEnrollments } from './ManageEnrollments'
import { ManageProctors } from './ManageProctors'
import { ExamResults } from './ExamResults'
import { CreateExamForm } from './AdminDashboard'
import toast from 'react-hot-toast'

type Tab = 'questions' | 'enrollments' | 'proctors' | 'results'

export const ExamManage: React.FC = () => {
    const { examId } = useParams<{ examId: string }>()
    const navigate = useNavigate()
    const [exam, setExam] = useState<Exam | null>(null)
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<Tab>('questions')
    const [showEdit, setShowEdit] = useState(false)
    const [showDelete, setShowDelete] = useState(false)

    const eid = examId!

    const load = () =>
        getExam(eid).then(setExam).catch(() => toast.error('Failed to load exam')).finally(() => setLoading(false))

    useEffect(() => { load() }, [eid]) // eslint-disable-line

    const handlePublish = async () => {
        try { await publishExam(eid); toast.success('Exam published!'); load() }
        catch (e: any) { toast.error(e.response?.data?.message || 'Failed') }
    }

    const handleDelete = async () => {
        try { await deleteExam(eid); toast.success('Exam deleted'); navigate('/admin') }
        catch (e: any) { toast.error(e.response?.data?.message || 'Failed') }
    }

    if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size="lg" /></div></Layout>
    if (!exam) return <Layout><p className="text-gray-500">Exam not found.</p></Layout>

    const tabs: { id: Tab; label: string }[] = [
        { id: 'questions', label: 'Questions' },
        { id: 'enrollments', label: 'Enrollments' },
        { id: 'proctors', label: 'Proctors' },
        { id: 'results', label: 'Results' },
    ]

    const isCompleted = exam.status === 'COMPLETED'

    return (
        <Layout>
            <button onClick={() => navigate('/admin')}
                className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-semibold mb-5 group">
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                All Exams
            </button>

            {/* Exam header card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-5 animate-fade-in-up">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h1 className="text-xl font-black text-gray-900">{exam.title}</h1>
                            <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
                        </div>
                        <p className="text-gray-500 text-sm ml-12">{exam.description}</p>
                        <div className="flex gap-4 text-xs text-gray-400 mt-3 ml-12">
                            <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {exam.durationMinutes} min
                            </span>
                            <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                {exam.totalMarks} marks
                            </span>
                            {exam.subject && <span>{exam.subject}</span>}
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {exam.status === 'DRAFT' && (
                            <Button size="sm" onClick={handlePublish}>Publish</Button>
                        )}
                        <div title={isCompleted ? 'Exam is completed — editing is disabled' : undefined}>
                            <Button size="sm" variant="secondary" disabled={isCompleted} onClick={() => !isCompleted && setShowEdit(true)}>Edit</Button>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/monitor?examId=${eid}`)}>Live Monitor</Button>
                        <div title={isCompleted ? 'Exam is completed — deletion is disabled' : undefined}>
                            <Button size="sm" variant="danger" disabled={isCompleted} onClick={() => !isCompleted && setShowDelete(true)}>Delete</Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6 gap-0">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all duration-200 ${tab === t.id
                            ? 'border-violet-600 text-violet-700'
                            : 'border-transparent text-gray-500 hover:text-violet-600 hover:border-violet-200'
                            }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="animate-fade-in">
                {tab === 'questions' && <QuestionManager examId={eid} isCompleted={isCompleted} totalMarks={exam.totalMarks} />}
                {tab === 'enrollments' && <ManageEnrollments examId={eid} isCompleted={isCompleted} />}
                {tab === 'proctors' && <ManageProctors examId={eid} isCompleted={isCompleted} />}
                {tab === 'results' && <ExamResults examId={eid} />}
            </div>

            <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Exam" size="lg">
                <CreateExamForm
                    initial={exam as any}
                    onSubmit={async req => {
                        const { updateExam } = await import('../../api/exams')
                        await updateExam(eid, req)
                        toast.success('Exam updated!')
                        setShowEdit(false)
                        load()
                    }}
                    onCancel={() => setShowEdit(false)}
                />
            </Modal>

            <ConfirmDialog
                open={showDelete}
                title="Delete Exam"
                message={`Delete "${exam.title}"? This cannot be undone.`}
                onConfirm={handleDelete}
                onCancel={() => setShowDelete(false)}
            />
        </Layout>
    )
}
