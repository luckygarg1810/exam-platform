import React, { useEffect } from 'react'

interface ModalProps {
    open: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'md' }) => {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        if (open) {
            document.addEventListener('keydown', handler)
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.removeEventListener('keydown', handler)
            document.body.style.overflow = ''
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 sm:items-center sm:p-0">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={onClose}
                />
                {/* Panel */}
                <div className={[
                    'relative bg-white rounded-2xl shadow-violet-lg w-full z-10 animate-scale-in',
                    'border border-violet-100 overflow-hidden',
                    sizes[size],
                ].join(' ')}>
                    {/* Top gradient stripe */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
                    <div className="p-6 pt-7">
                        {title && (
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
