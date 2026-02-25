import React from 'react'
import { Header } from './Header'

interface LayoutProps {
    children: React.ReactNode
    maxWidth?: string
}

export const Layout: React.FC<LayoutProps> = ({ children, maxWidth = 'max-w-7xl' }) => (
    <div className="min-h-screen bg-gray-50">
        <Header />
        <main className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
            {children}
        </main>
    </div>
)
