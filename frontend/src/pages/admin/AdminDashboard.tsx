import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, examStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { listExams, createExam, publishExam } from '../../api/exams'
import { Exam, CreateExamRequest } from '../../types'
import toast from 'react-hot-toast'

export const AdminDashboard: React.FC = () => {
    const navigate = useNavigate()
    const [exams, setExams] = useState<Exam[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [page, setPage] = useState(0)
    const [totalPages, setTotalPages] = useState(1)

    const load = async (p = 0) => {
        setLoading(true)
        try {
            const res = await listExams(p, 12)
            setExams(res.content)
            setTotalPages(res.totalPages)
            setPage(p)
        } catch { toast.error('Failed to load exams') }
        finally { setLoading(false) }
    }

    useEffect(() => { load(0) }, [])

    const handleCreate = async (req: CreateExamRequest) => {
        try {
            await createExam(req)
            setShowCreate(false)
            toast.success('Exam created!')
            load(0)
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Create failed')
        }
    }

    const handlePublish = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await publishExam(id)
            toast.success('Exam published!')
            load(page)
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Publish failed')
        }
    }

    return (
        <Layout>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage exams, students, and proctors</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => navigate('/admin/monitor')}>Live Monitor</Button>
                    <Button onClick={() => setShowCreate(true)}>+ New Exam</Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : exams.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
                    <p className="text-gray-400 mb-4">No exams yet.</p>
                    <Button onClick={() => setShowCreate(true)}>Create Your First Exam</Button>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {exams.map(exam => (
                            <div
                                key={exam.id}
                                onClick={() => navigate(`/admin/exams/${exam.id}`)}
                                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-semibold text-gray-900 text-sm pr-2 leading-snug">{exam.title}</h3>
                                    <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{exam.description}</p>
                                <div className="flex gap-3 text-xs text-gray-500 mb-3">
                                    <span>{exam.durationMinutes} min</span>
                                    <span>·</span>
                                    <span>{exam.totalMarks} marks</span>
                                </div>
                                {exam.status === 'DRAFT' && (
                                    <Button
                                        size="sm" variant="primary"
                                        onClick={e => handlePublish(exam.id, e)}
                                        className="w-full justify-center"
                                    >
                                        Publish
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-6">
                            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => load(page - 1)}>Previous</Button>
                            <span className="text-sm text-gray-500 self-center">Page {page + 1} of {totalPages}</span>
                            <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => load(page + 1)}>Next</Button>
                        </div>
                    )}
                </>
            )}

            <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Exam" size="lg">
                <CreateExamForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
            </Modal>
        </Layout>
    )
}

// ─── Inline Create Form ────────────────────────────────────────────────────────
const CreateExamForm: React.FC<{
    onSubmit: (req: CreateExamRequest) => Promise<void>
    onCancel: () => void
    initial?: Partial<CreateExamRequest>
}> = ({ onSubmit, onCancel, initial }) => {
    const [form, setForm] = useState<CreateExamRequest>({
        title: initial?.title ?? '',
        description: initial?.description ?? '',
        subject: initial?.subject ?? '',
        durationMinutes: initial?.durationMinutes ?? 60,
        totalMarks: initial?.totalMarks ?? 100,
        passingMarks: initial?.passingMarks ?? 40,
        startTime: initial?.startTime ?? '',
        endTime: initial?.endTime ?? '',
        shuffleQuestions: initial?.shuffleQuestions ?? false,
        shuffleOptions: initial?.shuffleOptions ?? false,
        maxAttempts: initial?.maxAttempts ?? 1,
    })
    const [loading, setLoading] = useState(false)

    const set = <K extends keyof CreateExamRequest>(k: K, v: CreateExamRequest[K]) =>
        setForm(f => ({ ...f, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onSubmit({
                ...form,
                startTime: form.startTime ? new Date(form.startTime).toISOString() : undefined,
                endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
            } as CreateExamRequest)
        } finally { setLoading(false) }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <label className="label">Title *</label>
                    <input required className="input" value={form.title}
                        onChange={e => set('title', e.target.value)} placeholder="Midterm Examination 2025" />
                </div>
                <div className="sm:col-span-2">
                    <label className="label">Description</label>
                    <textarea className="input resize-none" rows={2} value={form.description ?? ''}
                        onChange={e => set('description', e.target.value)} />
                </div>
                <div>
                    <label className="label">Subject</label>
                    <input className="input" value={form.subject ?? ''} onChange={e => set('subject', e.target.value)} />
                </div>
                <div>
                    <label className="label">Duration (minutes) *</label>
                    <input type="number" min={5} required className="input" value={form.durationMinutes}
                        onChange={e => set('durationMinutes', Number(e.target.value))} />
                </div>
                <div>
                    <label className="label">Total Marks *</label>
                    <input type="number" min={1} required className="input" value={form.totalMarks}
                        onChange={e => set('totalMarks', Number(e.target.value))} />
                </div>
                <div>
                    <label className="label">Passing Marks</label>
                    <input type="number" min={0} className="input" value={form.passingMarks ?? ''}
                        onChange={e => set('passingMarks', Number(e.target.value))} />
                </div>
                <div>
                    <label className="label">Start Time</label>
                    <input type="datetime-local" className="input" value={form.startTime ?? ''}
                        onChange={e => set('startTime', e.target.value)} />
                </div>
                <div>
                    <label className="label">End Time</label>
                    <input type="datetime-local" className="input" value={form.endTime ?? ''}
                        onChange={e => set('endTime', e.target.value)} />
                </div>
                <div>
                    <label className="label">Max Attempts</label>
                    <input type="number" min={1} className="input" value={form.maxAttempts ?? 1}
                        onChange={e => set('maxAttempts', Number(e.target.value))} />
                </div>
            </div>

            <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.shuffleQuestions}
                        onChange={e => set('shuffleQuestions', e.target.checked)} />
                    Shuffle Questions
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.shuffleOptions}
                        onChange={e => set('shuffleOptions', e.target.checked)} />
                    Shuffle Options
                </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
                <Button type="submit" loading={loading}>Create Exam</Button>
            </div>
        </form>
    )
}

export { CreateExamForm }
