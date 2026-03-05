import React from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: Size
    loading?: boolean
    icon?: React.ReactNode
}

const variants: Record<Variant, string> = {
    primary: [
        'bg-gradient-to-r from-violet-600 to-purple-600',
        'hover:from-violet-700 hover:to-purple-700',
        'text-white border-transparent shadow-violet hover:shadow-violet-lg',
        'active:scale-[0.98]',
    ].join(' '),
    secondary: [
        'bg-white hover:bg-violet-50',
        'text-violet-700 border border-violet-200 hover:border-violet-400',
        'shadow-card hover:shadow-violet-sm',
        'active:scale-[0.98]',
    ].join(' '),
    danger: [
        'bg-gradient-to-r from-red-500 to-rose-600',
        'hover:from-red-600 hover:to-rose-700',
        'text-white border-transparent shadow-sm',
        'active:scale-[0.98]',
    ].join(' '),
    ghost: [
        'bg-transparent hover:bg-violet-50',
        'text-violet-600 border-transparent',
        'active:scale-[0.98]',
    ].join(' '),
    success: [
        'bg-gradient-to-r from-emerald-500 to-green-600',
        'hover:from-emerald-600 hover:to-green-700',
        'text-white border-transparent shadow-sm',
        'active:scale-[0.98]',
    ].join(' '),
}

const sizes: Record<Size, string> = {
    sm: 'px-3.5 py-1.5 text-xs font-semibold rounded-lg',
    md: 'px-5 py-2.5 text-sm font-semibold rounded-xl',
    lg: 'px-6 py-3 text-base font-semibold rounded-xl',
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    loading,
    icon,
    children,
    disabled,
    className = '',
    ...rest
}) => (
    <button
        {...rest}
        disabled={disabled || loading}
        className={[
            'inline-flex items-center gap-2 font-semibold border transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
            variants[variant],
            sizes[size],
            className,
        ].join(' ')}
    >
        {loading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
        ) : icon}
        {children}
    </button>
)
