import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSession, submitSession } from '../../api/sessions'
import { getShuffledQuestions } from '../../api/questions'
import { saveAnswer, getAnswers } from '../../api/answers'
import { getExam } from '../../api/exams'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useProctoringCapture } from '../../hooks/useProctoringCapture'
import { ExamSession as Session, Question, AnswerDto } from '../../types'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

type SaveStatus = 'saved' | 'saving' | 'error'

export const ExamSession: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>()
    const navigate = useNavigate()

    const [session, setSession] = useState<Session | null>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [currentIdx, setCurrentIdx] = useState(0)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [confirmSubmit, setConfirmSubmit] = useState(false)
    const [timeLeft, setTimeLeft] = useState<number>(0)
    const [warnings, setWarnings] = useState<string[]>([])
    const [suspended, setSuspended] = useState<string | null>(null)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
    const timerRef = useRef<ReturnType<typeof setInterval>>()
    const heartbeatRef = useRef<ReturnType<typeof setInterval>>()

    const sid = sessionId!

    // WebSocket
    const ws = useWebSocket({
        sessionId: sid,
        onWarning: msg => {
            setWarnings(w => [...w, msg])
            toast('⚠️ Warning from proctor: ' + msg, { icon: '⚠️', style: { background: '#fef3c7' } })
        },
        onSuspend: reason => {
            setSuspended(reason)
            stopCapture()
        },
    })

    // Proctoring capture
    const { videoRef, canvasRef, startCapture, stopCapture } = useProctoringCapture({
        sessionId: sid,
        sendFrame: ws.sendFrame,
        sendAudio: ws.sendAudio,
        sendEvent: ws.sendEvent,
    })

    // Load data
    useEffect(() => {
        if (!sessionId) return
        const load = async () => {
            try {
                const [sess, savedAnswers] = await Promise.all([
                    getSession(sid),
                    getAnswers(sid),
                ])
                setSession(sess)

                const [shuffled, examData] = await Promise.all([
                    getShuffledQuestions(sess.examId),
                    getExam(sess.examId),
                ])
                setQuestions(shuffled)

                const ansMap: Record<string, string> = {}
                savedAnswers.forEach((a: AnswerDto) => { if (a.selectedAnswer) ansMap[a.questionId] = a.selectedAnswer })
                setAnswers(ansMap)

                // Calculate time remaining using extendedEndAt if available, otherwise startedAt + duration
                const durationMins = examData.durationMinutes ?? 60
                const startMs = new Date(sess.startedAt).getTime()
                const endMs = sess.extendedEndAt
                    ? new Date(sess.extendedEndAt).getTime()
                    : startMs + durationMins * 60 * 1000
                const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000))
                setTimeLeft(remaining)
            } catch {
                toast.error('Failed to load exam session')
                navigate('/student')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [sessionId]) // eslint-disable-line

    // Start proctoring + enter fullscreen
    useEffect(() => {
        if (!session || loading) return
        startCapture()
        document.documentElement.requestFullscreen?.().catch(() => { })

        // Timer
        timerRef.current = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(timerRef.current)
                    handleAutoSubmit()
                    return 0
                }
                return t - 1
            })
        }, 1000)

        // Heartbeat every 30s
        heartbeatRef.current = setInterval(() => {
            ws.sendHeartbeat(sid)
        }, 30_000)

        return () => {
            clearInterval(timerRef.current)
            clearInterval(heartbeatRef.current)
            stopCapture()
        }
    }, [session, loading]) // eslint-disable-line

    const handleAutoSubmit = useCallback(async () => {
        if (submitting) return
        await doSubmit()
    }, []) // eslint-disable-line

    const doSubmit = async () => {
        setSubmitting(true)
        try {
            stopCapture()
            clearInterval(timerRef.current)
            clearInterval(heartbeatRef.current)
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { })
            await submitSession(sid)
            navigate('/student/results', { replace: true })
            toast.success('Exam submitted successfully!')
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Submission failed')
            setSubmitting(false)
        }
    }

    const handleAnswerChange = async (questionId: string, value: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }))
        setSaveStatus('saving')
        try {
            await saveAnswer(sid, { sessionId: sid, questionId, selectedAnswer: value })
            setSaveStatus('saved')
        } catch {
            setSaveStatus('error')
            toast.error('Failed to save answer')
        }
    }

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        const s = secs % 60
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center flex-col gap-3">
                <Spinner size="lg" className="text-white" />
                <p className="text-gray-300 text-sm">Loading exam — please wait…</p>
            </div>
        )
    }

    if (suspended) {
        return (
            <div className="min-h-screen bg-red-900 flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Session Suspended</h1>
                    <p className="text-red-200 mb-6">{suspended}</p>
                    <Button variant="secondary" onClick={() => navigate('/student')}>Return to Dashboard</Button>
                </div>
            </div>
        )
    }

    const q = questions[currentIdx]
    const answeredCount = Object.keys(answers).length

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col select-none">
            {/* Hidden camera elements */}
            <video ref={videoRef} className="hidden" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />

            {/* Top bar */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-white font-semibold text-sm">{session?.examTitle ?? 'Exam'}</span>
                    {warnings.length > 0 && (
                        <span className="bg-yellow-500 text-yellow-900 text-xs font-medium px-2 py-0.5 rounded">
                            {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">
                        {answeredCount}/{questions.length} answered
                    </span>
                    <span className={`font-mono font-bold text-sm px-3 py-1 rounded ${timeLeft < 300 ? 'bg-red-900 text-red-300 animate-pulse' :
                        timeLeft < 600 ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-700 text-white'
                        }`}>
                        {formatTime(timeLeft)}
                    </span>
                    <div className={`flex items-center gap-1.5 text-xs ${saveStatus === 'saved' ? 'text-green-400' : saveStatus === 'saving' ? 'text-yellow-400' : 'text-red-400'}`}>
                        <span className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-green-400' : saveStatus === 'saving' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
                        {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Save failed'}
                    </div>
                </div>
            </div>

            {/* Camera preview + question area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar: question nav */}
                <div className="w-56 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto flex-shrink-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Questions</p>
                    <div className="grid grid-cols-4 gap-1.5">
                        {questions.map((_, i) => {
                            const answered = answers[questions[i]?.id] != null
                            const current = i === currentIdx
                            return (
                                <button
                                    key={i}
                                    onClick={() => setCurrentIdx(i)}
                                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${current ? 'bg-blue-600 text-white ring-2 ring-blue-400' :
                                        answered ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {i + 1}
                                </button>
                            )
                        })}
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="w-3 h-3 rounded bg-green-700 inline-block" />
                            Answered
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="w-3 h-3 rounded bg-gray-700 inline-block" />
                            Not answered
                        </div>
                    </div>
                </div>

                {/* Main question area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {q ? (
                        <div className="max-w-2xl mx-auto">
                            <div className="flex items-start justify-between mb-6">
                                <p className="text-xs text-gray-400 uppercase tracking-wide">
                                    Question {currentIdx + 1} of {questions.length}
                                </p>
                                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                                    {q.marks} mark{q.marks !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <h2 className="text-white text-base font-medium mb-5 leading-relaxed">{q.text}</h2>

                            {q.type === 'MCQ' ? (
                                <div className="space-y-3">
                                    {q.options?.map(opt => {
                                        const selected = answers[q.id] === opt.key
                                        return (
                                            <label
                                                key={opt.key}
                                                className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${selected
                                                    ? 'bg-blue-900/40 border-blue-500 ring-1 ring-blue-500'
                                                    : 'bg-gray-800 border-gray-600 hover:border-gray-400'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`q${q.id}`}
                                                    value={opt.key}
                                                    checked={selected}
                                                    onChange={() => handleAnswerChange(q.id, opt.key)}
                                                    className="text-blue-600"
                                                />
                                                <span className="text-gray-200 text-sm">{opt.text}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            ) : (
                                <textarea
                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-gray-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    rows={6}
                                    placeholder="Type your answer here…"
                                    value={answers[q.id] ?? ''}
                                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                                />
                            )}

                            {/* Navigation */}
                            <div className="flex items-center justify-between mt-8">
                                <Button
                                    variant="ghost"
                                    onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                                    disabled={currentIdx === 0}
                                    className="text-gray-300 border-gray-600 hover:bg-gray-700"
                                >
                                    ← Previous
                                </Button>
                                {currentIdx < questions.length - 1 ? (
                                    <Button
                                        variant="ghost"
                                        onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                                        className="text-gray-300 border-gray-600 hover:bg-gray-700"
                                    >
                                        Next →
                                    </Button>
                                ) : (
                                    <Button onClick={() => setConfirmSubmit(true)} variant="success" size="md">
                                        Submit Exam
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 py-20">No questions available.</div>
                    )}
                </div>

                {/* Right panel: camera + submit */}
                <div className="w-48 bg-gray-800 border-l border-gray-700 p-4 flex-shrink-0 flex flex-col gap-4">
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Camera</p>
                        <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative">
                            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                            <span className="absolute bottom-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-center">Proctored</p>
                    </div>

                    <Button
                        onClick={() => setConfirmSubmit(true)}
                        variant="success"
                        size="sm"
                        className="w-full justify-center mt-auto"
                    >
                        Submit
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                open={confirmSubmit}
                title="Submit Exam?"
                message={`You have answered ${answeredCount} of ${questions.length} questions. Once submitted, you cannot change your answers.`}
                confirmLabel="Submit Now"
                cancelLabel="Continue Exam"
                variant="primary"
                onConfirm={() => { setConfirmSubmit(false); doSubmit() }}
                onCancel={() => setConfirmSubmit(false)}
            />
        </div>
    )
}
