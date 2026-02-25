import React, { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { listQuestions, createQuestion, updateQuestion, deleteQuestion } from '../../api/questions'
import { Question, CreateQuestionRequest, QuestionType } from '../../types'
import toast from 'react-hot-toast'

export const QuestionManager: React.FC<{ examId: string }> = ({ examId }) => {
    const [questions, setQuestions] = useState<Question[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState<Question | null>(null)
    const [deleting, setDeleting] = useState<Question | null>(null)

    const load = () =>
        listQuestions(examId).then(p => setQuestions(p.content ?? [])).catch(() => toast.error('Failed to load questions')).finally(() => setLoading(false))

    useEffect(() => { load() }, [examId]) // eslint-disable-line

    const handleSave = async (req: CreateQuestionRequest) => {
        try {
            if (editing) {
                await updateQuestion(examId, editing.id, req)
                toast.success('Question updated')
            } else {
                await createQuestion(examId, req)
                toast.success('Question added')
            }
            setShowAdd(false); setEditing(null); load()
        } catch (e: any) { toast.error(e.response?.data?.message || 'Save failed') }
    }

    const handleDelete = async () => {
        if (!deleting) return
        try { await deleteQuestion(examId, deleting.id); toast.success('Deleted'); setDeleting(null); load() }
        catch (e: any) { toast.error(e.response?.data?.message || 'Delete failed') }
    }

    const totalMarks = questions.reduce((s, q) => s + q.marks, 0)

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{questions.length} question(s) · {totalMarks} total marks</p>
                <Button size="sm" onClick={() => setShowAdd(true)}>+ Add Question</Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
            ) : questions.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
                    No questions yet.
                </div>
            ) : (
                <div className="space-y-3">
                    {questions.map((q, i) => (
                        <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-bold text-gray-400 w-6 flex-shrink-0">{i + 1}.</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-gray-900">{q.text}</p>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <Badge variant={q.type === 'MCQ' ? 'blue' : 'purple'} label={q.type} />
                                            <span className="text-xs text-gray-500">{q.marks} mk</span>
                                        </div>
                                    </div>
                                    {q.options && q.options.length > 0 && (
                                        <div className="mt-2 grid grid-cols-2 gap-1">
                                            {q.options.map(o => (
                                                <span key={o.key} className={`text-xs px-2 py-0.5 rounded ${o.key === q.correctAnswer ? 'bg-green-100 text-green-800 font-medium' : 'text-gray-500'}`}>
                                                    {o.key}: {o.text}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button onClick={() => { setEditing(q); setShowAdd(true) }}
                                        className="text-xs text-blue-600 hover:underline">Edit</button>
                                    <button onClick={() => setDeleting(q)}
                                        className="text-xs text-red-500 hover:underline">Delete</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={showAdd} onClose={() => { setShowAdd(false); setEditing(null) }}
                title={editing ? 'Edit Question' : 'Add Question'} size="lg">
                <QuestionForm initial={editing} onSubmit={handleSave} onCancel={() => { setShowAdd(false); setEditing(null) }} />
            </Modal>

            <ConfirmDialog open={!!deleting} title="Delete Question"
                message={`Delete this question? This cannot be undone.`}
                onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
        </div>
    )
}

// ─── Question Form ─────────────────────────────────────────────────────────────
const emptyOption = () => ({ key: '', text: '' })

const QuestionForm: React.FC<{
    initial?: Question | null
    onSubmit: (req: CreateQuestionRequest) => Promise<void>
    onCancel: () => void
}> = ({ initial, onSubmit, onCancel }) => {
    const [type, setType] = useState<QuestionType>(initial?.type ?? 'MCQ')
    const [text, setText] = useState(initial?.text ?? '')
    const [marks, setMarks] = useState(initial?.marks ?? 1)
    const [correctAnswer, setCorrectAnswer] = useState(initial?.correctAnswer ?? '')
    const [options, setOptions] = useState<{ key: string; text: string }[]>(
        initial?.options?.map(o => ({ key: o.key, text: o.text })) ?? [emptyOption(), emptyOption(), emptyOption(), emptyOption()]
    )
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const req: CreateQuestionRequest = {
                text, type, marks, correctAnswer,
                options: type === 'MCQ' ? options.filter(o => o.key && o.text) : undefined,
            }
            await onSubmit(req)
        } finally { setLoading(false) }
    }

    const setOpt = (i: number, field: 'key' | 'text', val: string) => {
        setOptions(opts => opts.map((o, idx) => idx === i ? { ...o, [field]: val } : o))
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="label">Question Type</label>
                <select className="input" value={type} onChange={e => setType(e.target.value as QuestionType)}>
                    <option value="MCQ">Multiple Choice (MCQ)</option>
                    <option value="SHORT_ANSWER">Short Answer</option>
                </select>
            </div>
            <div>
                <label className="label">Question Text *</label>
                <textarea required className="input resize-none" rows={3} value={text}
                    onChange={e => setText(e.target.value)} placeholder="Enter your question here…" />
            </div>
            <div>
                <label className="label">Marks *</label>
                <input type="number" min={1} required className="input" value={marks}
                    onChange={e => setMarks(Number(e.target.value))} />
            </div>

            {type === 'MCQ' && (
                <div>
                    <label className="label">Options</label>
                    <div className="space-y-2">
                        {options.map((o, i) => (
                            <div key={i} className="flex gap-2">
                                <input className="input w-16 text-center" placeholder="Key" value={o.key}
                                    onChange={e => setOpt(i, 'key', e.target.value)} maxLength={1} />
                                <input className="input flex-1" placeholder={`Option ${i + 1}`} value={o.text}
                                    onChange={e => setOpt(i, 'text', e.target.value)} />
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={() => setOptions(o => [...o, emptyOption()])}
                        className="text-xs text-blue-600 hover:underline mt-1">+ Add option</button>
                </div>
            )}

            <div>
                <label className="label">Correct Answer *</label>
                <input required className="input" value={correctAnswer}
                    onChange={e => setCorrectAnswer(e.target.value)}
                    placeholder={type === 'MCQ' ? 'Enter option key (e.g. A)' : 'Enter correct answer text'} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
                <Button type="submit" loading={loading}>{initial ? 'Update' : 'Add Question'}</Button>
            </div>
        </form>
    )
}
