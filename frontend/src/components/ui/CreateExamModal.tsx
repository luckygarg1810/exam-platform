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
    isDuplicate?: boolean
}

/** Returns a local datetime-local string (YYYY-MM-DDTHH:mm) offset by `offsetMinutes` from now */
const localNow = (offsetMinutes = 0): string => {
    const d = new Date(Date.now() + offsetMinutes * 60 * 1000)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000)
        .toISOString()
        .slice(0, 16)
}

/** Converts a server UTC ISO string to a local datetime-local input value */
const toLocalInput = (iso: string): string => {
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000)
        .toISOString()
        .slice(0, 16)
}

export const CreateExamModal: React.FC<Props> = ({ open, onClose, onSuccess, initial, isDuplicate }) => {
    const [form, setForm] = useState<Partial<CreateExamRequest>>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            if (initial && !isDuplicate) {
                // Edit mode — show existing scheduled times converted to local tz
                setForm({
                    title: initial.title,
                    description: initial.description,
                    subject: initial.subject,
                    durationMinutes: initial.durationMinutes,
                    totalMarks: initial.totalMarks,
                    passingMarks: initial.passingMarks,
                    startTime: initial.startTime ? toLocalInput(initial.startTime) : localNow(5),
                    endTime: initial.endTime ? toLocalInput(initial.endTime) : localNow((initial.durationMinutes ?? 60) + 10),
                    shuffleQuestions: initial.shuffleQuestions,
                    shuffleOptions: initial.shuffleOptions,
                })
            } else if (initial && isDuplicate) {
                // Duplicate mode — copy metadata but reset times to near future
                setForm({
                    title: initial.title + ' (Copy)',
                    description: initial.description,
                    subject: initial.subject,
                    durationMinutes: initial.durationMinutes,
                    totalMarks: initial.totalMarks,
                    passingMarks: initial.passingMarks,
                    startTime: localNow(5),
                    endTime: localNow((initial.durationMinutes ?? 60) + 10),
                    shuffleQuestions: initial.shuffleQuestions,
                    shuffleOptions: initial.shuffleOptions,
                })
            } else {
                // Create mode — sensible defaults relative to now
                setForm({
                    title: '',
                    description: '',
                    subject: '',
                    durationMinutes: 60,
                    totalMarks: 100,
                    passingMarks: 40,
                    startTime: localNow(5),
                    endTime: localNow(70),
                    shuffleQuestions: false,
                    shuffleOptions: false,
                })
            }
        }
    }, [open, initial, isDuplicate])

    const set = <K extends keyof CreateExamRequest>(k: K, v: CreateExamRequest[K]) =>
        setForm(f => ({ ...f, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (form.startTime && form.endTime && form.startTime >= form.endTime) {
            toast.error('End time must be after start time')
            return
        }
        setLoading(true)
        try {
            const req = {
                ...form,
                startTime: form.startTime ? new Date(form.startTime).toISOString() : undefined,
                endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
            } as CreateExamRequest

            if (initial && !isDuplicate) {
                await updateExam(initial.id, req)
                toast.success('Exam updated successfully!')
            } else {
                await createExam(req)
                toast.success(isDuplicate ? 'Similar exam created successfully!' : 'Exam created successfully!')
            }
            onSuccess()
            onClose()
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save exam')
        } finally {
            setLoading(false)
        }
    }

    const minDateTime = localNow(0) // disallow past datetimes

    return (
        <Modal open={open} onClose={onClose} title={isDuplicate ? "Create Similar Exam" : initial ? "Edit Exam" : "Create New Exam"} size="md">
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
                        <label className="label">Start Time *</label>
                        <input type="datetime-local" required className="input" value={form.startTime ?? ''}
                            min={minDateTime}
                            onChange={e => set('startTime', e.target.value)} />
                    </div>
                    <div>
                        <label className="label">End Time *</label>
                        <input type="datetime-local" required className="input" value={form.endTime ?? ''}
                            min={form.startTime || minDateTime}
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
                    <Button type="submit" loading={loading}>{(initial && !isDuplicate) ? "Save Changes" : "Create Exam"}</Button>
                </div>
            </form>
        </Modal>
    )
}
