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
            <button onClick={() => navigate('/student')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
                ← Back to Dashboard
            </button>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                        <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
                        <Badge variant={examStatusBadge(exam.status)} label={exam.status} />
                    </div>
                    <p className="text-gray-600 text-sm">{exam.description}</p>
                </div>

                <div className="p-6 grid grid-cols-2 gap-4">
                    <InfoRow label="Duration" value={`${exam.durationMinutes} minutes`} />
                    <InfoRow label="Total Marks" value={`${exam.totalMarks}`} />
                    <InfoRow label="Passing Marks" value={`${exam.passingMarks ?? '—'}`} />
                    <InfoRow label="Subject" value={exam.subject ?? '—'} />
                    {exam.startTime && <InfoRow label="Starts At" value={new Date(exam.startTime).toLocaleString()} />}
                    {exam.endTime && <InfoRow label="Ends At" value={new Date(exam.endTime).toLocaleString()} />}
                </div>

                <div className="px-6 pb-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-5">
                        <h3 className="text-sm font-semibold text-yellow-800 mb-2">Before You Start</h3>
                        <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                            <li>This exam uses AI proctoring. Your camera and microphone will be active.</li>
                            <li>The exam will be taken in fullscreen mode. Exiting fullscreen is flagged.</li>
                            <li>Switching tabs or windows is detected and logged.</li>
                            <li>Copy, paste, and right-click are disabled during the exam.</li>
                            <li>Do not close the browser until you have submitted.</li>
                        </ul>
                    </div>

                    {canStart ? (
                        <Button onClick={handleStart} loading={starting} size="lg" className="w-full justify-center">
                            Start Exam
                        </Button>
                    ) : (
                        <div className="text-center text-gray-400 text-sm py-3">
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
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
    </div>
)
