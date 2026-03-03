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

    const counts = {
        draft: exams.filter(e => e.status === 'DRAFT').length,
        published: exams.filter(e => e.status === 'PUBLISHED').length,
        ongoing: exams.filter(e => e.status === 'ONGOING').length,
        completed: exams.filter(e => e.status === 'COMPLETED').length,
    }

    return (
        <Layout>
            {/* Page header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-7 animate-fade-in-down">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Administration</p>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Exam Dashboard</h1>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => navigate('/admin/monitor')}
                            icon={
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                                </svg>
                            }>
                            Live Monitor
                        </Button>
                        <Button onClick={() => setShowCreate(true)}
                            icon={
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            }>
                            New Exam
                        </Button>
                    </div>
                </div>

                {/* Stat chips */}
                <div className="flex flex-wrap gap-3 mt-5">
                    {[
                        { label: 'Draft', count: counts.draft, color: 'bg-gray-50 border border-gray-200 text-gray-700' },
                        { label: 'Published', count: counts.published, color: 'bg-violet-50 border border-violet-200 text-violet-700' },
                        { label: 'Ongoing', count: counts.ongoing, color: 'bg-emerald-50 border border-emerald-200 text-emerald-700' },
                        { label: 'Completed', count: counts.completed, color: 'bg-purple-50 border border-purple-200 text-purple-700' },
                    ].map(s => (
                        <div key={s.label} className={`${s.color} rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-semibold`}>
                            <span className="text-xl font-black">{s.count}</span>
                            <span className="text-xs opacity-80">{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="text-center">
                        <Spinner size="lg" />
                            <p className="text-gray-400 text-sm mt-3">Loading exams...</p>
                    </div>
                </div>
            ) : exams.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 text-center py-20 shadow-card">
                    <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <p className="text-gray-400 text-sm mb-4">No exams created yet.</p>
                    <Button onClick={() => setShowCreate(true)}>Create Your First Exam</Button>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {exams.map((exam, i) => (
                            <div
                                key={exam.id}
                                onClick={() => navigate(`/admin/exams/${exam.id}`)}
                                className={`group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 cursor-pointer animate-fade-in-up animate-fill-both stagger-${Math.min(i + 1, 6)}`}
                            >
                                {/* Top accent bar */}
                                <div className={`h-1 w-12 rounded-full mb-4 ${exam.status === 'ONGOING' ? 'bg-emerald-400' :
                                        exam.status === 'PUBLISHED' ? 'bg-violet-500' :
                                            exam.status === 'COMPLETED' ? 'bg-purple-500' : 'bg-gray-300'
                                    }`} />
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-bold text-gray-900 text-sm pr-2 leading-snug group-hover:text-violet-700 transition-colors">{exam.title}</h3>
                                    <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
                                </div>
                                <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">{exam.description}</p>
                                <div className="flex gap-4 text-xs text-gray-400 mb-4">
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
                                </div>
                                {exam.status === 'DRAFT' && (
                                    <Button
                                        size="sm" variant="primary"
                                        onClick={e => handlePublish(exam.id, e)}
                                        className="w-full justify-center"
                                    >
                                        Publish Exam
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-3 mt-8">
                            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => load(page - 1)}>← Previous</Button>
                            <span className="text-sm text-violet-600 font-semibold bg-violet-50 px-3 py-1.5 rounded-lg">Page {page + 1} / {totalPages}</span>
                            <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => load(page + 1)}>Next →</Button>
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
