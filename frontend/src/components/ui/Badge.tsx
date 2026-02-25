import React from 'react'

type BadgeVariant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange'

const variants: Record<BadgeVariant, string> = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
        {label}
    </span>
)
