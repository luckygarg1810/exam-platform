import React, { useEffect, useState } from 'react'
import { Spinner } from '../../components/ui/Spinner'
import { getExamResults, exportExamCsv } from '../../api/reports'
import { ExamResultRow } from '../../types'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'

export const ExamResults: React.FC<{ examId: string }> = ({ examId }) => {
    const [results, setResults] = useState<ExamResultRow[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        getExamResults(examId).then(p => setResults(p.content ?? [])).catch(() => toast.error('Failed to load results')).finally(() => setLoading(false))
    }, [examId])

    const handleExport = async () => {
        setExporting(true)
        try {
            const blob = await exportExamCsv(examId)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `exam_${examId}_results.csv`; a.click()
            URL.revokeObjectURL(url)
        } catch { toast.error('Export failed') }
        finally { setExporting(false) }
    }

    return (
        <div>
            <div className="flex justify-end mb-3">
                <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting}>
                    Export CSV
                </Button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : results.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">No results yet.</p>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Student', 'Roll No.', 'Score', 'Marks', 'Submitted', 'Suspended'].map(h => (
                                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {results.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{r.studentName}</td>
                                    <td className="px-4 py-2 text-sm text-gray-500">{r.universityRoll ?? '—'}</td>
                                    <td className="px-4 py-2 text-sm font-bold">
                                        {r.score != null ? <span className={r.score >= 50 ? 'text-green-600' : 'text-red-600'}>{r.score}%</span> : '—'}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-500">
                                        {r.score != null && r.totalMarks != null ? `${r.score} / ${r.totalMarks}` : '—'}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-400">
                                        {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                        <span className={r.isSuspended ? 'text-red-500 font-medium' : 'text-gray-400'}>
                                            {r.isSuspended ? 'Suspended' : '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
