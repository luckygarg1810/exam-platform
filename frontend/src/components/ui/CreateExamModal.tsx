import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { CreateExamRequest, Exam } from '../../types'
import { createExam, updateExam } from '../../api/exams'
import toast from 'react-hot-toast'

interface Props {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    initial?: Exam | null
}

export const CreateExamModal: React.FC<Props> = ({ open, onClose, onSuccess, initial }) => {
    const [form, setForm] = useState<Partial<CreateExamRequest>>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            if (initial) {
                setForm({
                    title: initial.title,
                    description: initial.description,
                    subject: initial.subject,
                    durationMinutes: initial.durationMinutes,
                    totalMarks: initial.totalMarks,
                    passingMarks: initial.passingMarks,
                    startTime: initial.startTime ? initial.startTime.slice(0, 16) : '',
                    endTime: initial.endTime ? initial.endTime.slice(0, 16) : '',
                    shuffleQuestions: initial.shuffleQuestions,
                    shuffleOptions: initial.shuffleOptions,
                })
            } else {
                setForm({
                    title: '',
                    description: '',
                    subject: '',
                    durationMinutes: 60,
                    totalMarks: 100,
                    passingMarks: 40,
                    startTime: '',
                    endTime: '',
                    shuffleQuestions: false,
                    shuffleOptions: false,
                })
            }
        }
    }, [open, initial])

    const set = <K extends keyof CreateExamRequest>(k: K, v: CreateExamRequest[K]) =>
        setForm(f => ({ ...f, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const req = {
                ...form,
                startTime: form.startTime ? new Date(form.startTime).toISOString() : undefined,
                endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
            } as CreateExamRequest

            if (initial) {
                await updateExam(initial.id, req)
                toast.success('Exam updated successfully!')
            } else {
                await createExam(req)
                toast.success('Exam created successfully!')
            }
            onSuccess()
            onClose()
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save exam')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={initial ? "Edit Exam" : "Create New Exam"} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="label">Title *</label>
                        <input required className="input" value={form.title ?? ''}
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
                        <input type="number" min={5} required className="input" value={form.durationMinutes ?? 60}
                            onChange={e => set('durationMinutes', Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="label">Total Marks *</label>
                        <input type="number" min={1} required className="input" value={form.totalMarks ?? 100}
                            onChange={e => set('totalMarks', Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="label">Passing Marks</label>
                        <input type="number" min={0} className="input" value={form.passingMarks ?? ''}
                            onChange={e => set('passingMarks', Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="label">Start Time</label>
                        <input type="datetime-local" required className="input" value={form.startTime ?? ''}
                            onChange={e => set('startTime', e.target.value)} />
                    </div>
                    <div>
                        <label className="label">End Time</label>
                        <input type="datetime-local" required className="input" value={form.endTime ?? ''}
                            onChange={e => set('endTime', e.target.value)} />
                    </div>
                </div>

                <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={form.shuffleQuestions ?? false}
                            onChange={e => set('shuffleQuestions', e.target.checked)} />
                        Shuffle Questions
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={form.shuffleOptions ?? false}
                            onChange={e => set('shuffleOptions', e.target.checked)} />
                        Shuffle Options
                    </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
                    <Button type="submit" loading={loading}>{initial ? "Save Changes" : "Create Exam"}</Button>
                </div>
            </form>
        </Modal>
    )
}
