import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { Badge, examStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { getExam } from '../../api/exams'
import { startSession } from '../../api/sessions'
import { Exam } from '../../types'
import toast from 'react-hot-toast'

export const ExamDetail: React.FC = () => {
    const { examId } = useParams<{ examId: string }>()
    const navigate = useNavigate()
    const [exam, setExam] = useState<Exam | null>(null)
    const [loading, setLoading] = useState(true)
    const [starting, setStarting] = useState(false)

    useEffect(() => {
        if (!examId) return
        getExam(examId!)
            .then(setExam)
            .catch(() => toast.error('Failed to load exam'))
            .finally(() => setLoading(false))
    }, [examId])

    const handleStart = async () => {
        if (!exam) return
        setStarting(true)
        try {
            const session = await startSession(exam.id)
            navigate(`/student/session/${session.id}`)
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Could not start exam')
        } finally {
            setStarting(false)
        }
    }

    if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size="lg" /></div></Layout>
    if (!exam) return <Layout><p className="text-gray-500">Exam not found.</p></Layout>

    const canStart = exam.status === 'PUBLISHED' || exam.status === 'ONGOING'

    return (
        <Layout maxWidth="max-w-2xl">
            <button onClick={() => navigate('/student')}
                className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-semibold mb-5 group">
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
            </button>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-100 p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center mb-3">
                                <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h1 className="text-xl font-black text-gray-900 leading-tight flex-1 pr-3">{exam.title}</h1>
                        </div>
                        <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
                    </div>
                    {exam.description && <p className="text-gray-500 text-sm mt-2">{exam.description}</p>}
                </div>

                {/* Info grid */}
                <div className="p-6 grid grid-cols-2 gap-4 border-b border-gray-100">
                    <InfoRow label="Duration" value={`${exam.durationMinutes} minutes`} />
                    <InfoRow label="Total Marks" value={`${exam.totalMarks}`} />
                    <InfoRow label="Passing Marks" value={`${exam.passingMarks ?? '—'}`} />
                    <InfoRow label="Subject" value={exam.subject ?? '—'} />
                    {exam.startTime && <InfoRow label="Starts At" value={new Date(exam.startTime).toLocaleString()} />}
                    {exam.endTime && <InfoRow label="Ends At" value={new Date(exam.endTime).toLocaleString()} />}
                </div>

                {/* Instructions */}
                <div className="p-6">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                        <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Before You Start
                        </h3>
                        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                            <li>This exam uses AI proctoring. Your camera and microphone will be active.</li>
                            <li>The exam will be taken in fullscreen mode. Exiting fullscreen is flagged.</li>
                            <li>Switching tabs or windows is detected and logged.</li>
                            <li>Copy, paste, and right-click are disabled during the exam.</li>
                            <li>Do not close the browser until you have submitted.</li>
                        </ul>
                    </div>

                    {canStart ? (
                        <button onClick={handleStart} disabled={starting}
                            className="w-full btn-gradient text-white font-bold py-3.5 rounded-xl text-base shadow-violet hover:shadow-violet-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60">
                            {starting ? (
                                <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Starting...</>
                            ) : (
                                <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Start Exam</>
                            )}
                        </button>
                    ) : (
                        <div className="text-center text-gray-400 text-sm py-3 bg-gray-50 rounded-xl">
                            This exam is not currently available.
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
)
