import React, { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { listExams } from '../../api/exams'
import { listQuestions, importQuestions } from '../../api/questions'
import { Exam, Question } from '../../types'
import toast from 'react-hot-toast'

interface Props {
    open: boolean
    targetExamId: string
    targetTotalMarks: number
    usedMarks: number
    onImported: () => void
    onClose: () => void
}

export const ImportQuestionsModal: React.FC<Props> = ({
    open, targetExamId, targetTotalMarks, usedMarks, onImported, onClose,
}) => {
    const [exams, setExams] = useState<Exam[]>([])
    const [examsLoading, setExamsLoading] = useState(false)
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [questionsLoading, setQuestionsLoading] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [importing, setImporting] = useState(false)

    // Load all exams (excluding the target) when modal opens
    useEffect(() => {
        if (!open) return
        setSelectedExam(null)
        setQuestions([])
        setSelected(new Set())
        setExamsLoading(true)
        listExams(0, 100)
            .then(res => setExams((res.content ?? []).filter(e => e.id !== targetExamId)))
            .catch(() => toast.error('Failed to load exams'))
            .finally(() => setExamsLoading(false))
    }, [open, targetExamId])

    // Load questions when an exam is selected
    useEffect(() => {
        if (!selectedExam) return
        setQuestionsLoading(true)
        setSelected(new Set())
        listQuestions(selectedExam.id, 0, 200)
            .then(res => setQuestions(res.content ?? []))
            .catch(() => toast.error('Failed to load questions'))
            .finally(() => setQuestionsLoading(false))
    }, [selectedExam])

    const remaining = targetTotalMarks - usedMarks
    const selectedMarks = questions
        .filter(q => selected.has(q.id))
        .reduce((s, q) => s + q.marks, 0)

    const toggleQuestion = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAll = (on: boolean) => {
        if (on) setSelected(new Set(questions.map(q => q.id)))
        else setSelected(new Set())
    }

    const handleImport = async () => {
        if (selected.size === 0) { toast.error('Select at least one question'); return }
        if (selectedMarks > remaining) {
            toast.error(`Selected questions total ${selectedMarks} marks, but only ${remaining} marks remaining`)
            return
        }
        setImporting(true)
        try {
            const added = await importQuestions(targetExamId, selectedExam!.id, Array.from(selected))
            toast.success(`${added.length} question(s) imported successfully`)
            onImported()
            onClose()
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Import failed')
        } finally {
            setImporting(false)
        }
    }

    const allSelected = questions.length > 0 && selected.size === questions.length

    return (
        <Modal open={open} onClose={onClose} title="Import Questions from Another Exam" size="lg">
            <div className="flex gap-4 h-[480px]">
                {/* Left panel: exam list */}
                <div className="w-56 flex-shrink-0 border-r border-gray-100 pr-4 overflow-y-auto">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Your Exams</p>
                    {examsLoading ? (
                        <div className="flex justify-center py-4"><Spinner /></div>
                    ) : exams.length === 0 ? (
                        <p className="text-xs text-gray-400 mt-4 text-center">No other exams found.</p>
                    ) : (
                        <ul className="space-y-1">
                            {exams.map(exam => (
                                <li key={exam.id}>
                                    <button
                                        onClick={() => setSelectedExam(exam)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${selectedExam?.id === exam.id
                                            ? 'bg-violet-600 text-white'
                                            : 'text-gray-700 hover:bg-violet-50 hover:text-violet-700'
                                            }`}
                                    >
                                        <span className="block truncate">{exam.title}</span>
                                        <span className={`text-[10px] font-medium mt-0.5 block ${selectedExam?.id === exam.id ? 'text-violet-200' : 'text-gray-400'}`}>
                                            {exam.totalMarks} marks &middot; {exam.status}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Right panel: questions */}
                <div className="flex-1 flex flex-col min-w-0">
                    {!selectedExam ? (
                        <div className="flex-1 flex items-center justify-center text-center">
                            <div>
                                <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <p className="text-sm text-gray-400">Select an exam to browse its questions</p>
                            </div>
                        </div>
                    ) : questionsLoading ? (
                        <div className="flex-1 flex items-center justify-center"><Spinner /></div>
                    ) : questions.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-sm text-gray-400">This exam has no questions.</p>
                        </div>
                    ) : (
                        <>
                            {/* Header row */}
                            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={e => toggleAll(e.target.checked)}
                                        className="rounded text-violet-600"
                                    />
                                    Select all ({questions.length})
                                </label>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${selectedMarks > remaining ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-violet-50 text-violet-600'}`}>
                                    {selectedMarks} / {remaining} marks remaining
                                </span>
                            </div>

                            {/* Question list */}
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                {questions.map((q, i) => (
                                    <label
                                        key={q.id}
                                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected.has(q.id)
                                            ? 'border-violet-300 bg-violet-50'
                                            : 'border-gray-100 bg-white hover:border-violet-200 hover:bg-violet-50/40'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.has(q.id)}
                                            onChange={() => toggleQuestion(q.id)}
                                            className="mt-0.5 flex-shrink-0 rounded text-violet-600"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] font-black text-white bg-violet-500 w-4 h-4 rounded flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                                <p className="text-xs font-semibold text-gray-800 truncate">{q.text}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-400">{q.type}</span>
                                                <span className="text-[10px] font-bold text-violet-600">{q.marks} mk</span>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4 flex-shrink-0">
                        <p className="text-xs text-gray-400">
                            {selected.size > 0 ? `${selected.size} question(s) · ${selectedMarks} marks selected` : 'No questions selected'}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
                            <Button
                                size="sm"
                                disabled={selected.size === 0 || selectedMarks > remaining}
                                loading={importing}
                                onClick={handleImport}
                            >
                                Import {selected.size > 0 ? `(${selected.size})` : ''}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
