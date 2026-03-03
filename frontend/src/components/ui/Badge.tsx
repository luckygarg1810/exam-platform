import React from 'react'

type BadgeVariant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange'

const variants: Record<BadgeVariant, string> = {
    gray: 'bg-gray-100/80 text-gray-600 ring-1 ring-gray-200/80',
    blue: 'bg-violet-100/80 text-violet-700 ring-1 ring-violet-200/80',
    green: 'bg-emerald-100/80 text-emerald-700 ring-1 ring-emerald-200/80',
    yellow: 'bg-amber-100/80 text-amber-700 ring-1 ring-amber-200/80',
    red: 'bg-red-100/80 text-red-700 ring-1 ring-red-200/80',
    purple: 'bg-purple-100/80 text-purple-700 ring-1 ring-purple-200/80',
    orange: 'bg-orange-100/80 text-orange-700 ring-1 ring-orange-200/80',
}

const dots: Record<BadgeVariant, string> = {
    gray: 'bg-gray-400',
    blue: 'bg-violet-500',
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
}

export function examStatusBadge(status: string): BadgeVariant {
    switch (status) {
        case 'DRAFT': return 'gray'
        case 'PUBLISHED': return 'blue'
        case 'ONGOING': return 'green'
        case 'COMPLETED': return 'purple'
        default: return 'gray'
    }
}

export function sessionStatusBadge(status: string): BadgeVariant {
    switch (status) {
        case 'ACTIVE': return 'green'
        case 'SUBMITTED': return 'blue'
        case 'SUSPENDED': return 'red'
        case 'TIMED_OUT': return 'orange'
        default: return 'gray'
    }
}

export const Badge: React.FC<{ variant?: BadgeVariant; label: string }> = ({
    variant = 'gray',
    label,
}) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${variants[variant]}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dots[variant]}`} />
        {label}
    </span>
)
