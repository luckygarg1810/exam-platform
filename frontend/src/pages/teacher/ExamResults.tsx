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
            <div className="flex justify-end mb-4">
                <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Export CSV
                </Button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : results.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <p className="text-sm text-gray-400">No results yet.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Student', 'Roll No.', 'Score', 'Marks', 'Submitted', 'Status'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {results.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{r.studentName}</td>
                                    <td className="px-4 py-3 text-sm font-mono text-violet-700 font-bold">{r.universityRoll ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        {r.scorePercent != null
                                            ? <span className={`text-sm font-black px-2.5 py-1 rounded-xl ${r.scorePercent >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.scorePercent.toFixed(1)}%</span>
                                            : <span className="text-gray-400 text-sm">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {r.score != null && r.totalMarks != null ? `${r.score} / ${r.totalMarks}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-400">
                                        {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {r.isSuspended
                                            ? <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">Suspended</span>
                                            : <span className="text-xs text-gray-400">—</span>}
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
