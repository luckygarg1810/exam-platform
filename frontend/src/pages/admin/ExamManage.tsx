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

    return (
        <Layout>
            <button onClick={() => navigate('/admin')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
                ← All Exams
            </button>

            {/* Exam header */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
                            <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
                        </div>
                        <p className="text-sm text-gray-500">{exam.description}</p>
                        <div className="flex gap-4 text-xs text-gray-500 mt-2">
                            <span>{exam.durationMinutes} min</span>
                            <span>{exam.totalMarks} marks</span>
                            {exam.subject && <span>{exam.subject}</span>}
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {exam.status === 'DRAFT' && (
                            <Button size="sm" onClick={handlePublish}>Publish</Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => setShowEdit(true)}>Edit</Button>
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/monitor?examId=${eid}`)}>Live Monitor</Button>
                        <Button size="sm" variant="danger" onClick={() => setShowDelete(true)}>Delete</Button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-5 gap-1">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'questions' && <QuestionManager examId={eid} />}
            {tab === 'enrollments' && <ManageEnrollments examId={eid} />}
            {tab === 'proctors' && <ManageProctors examId={eid} />}
            {tab === 'results' && <ExamResults examId={eid} />}

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
