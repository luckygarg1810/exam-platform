/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f5f3ff',
                    100: '#ede9fe',
                    200: '#ddd6fe',
                    300: '#c4b5fd',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9',
                    800: '#5b21b6',
                    900: '#4c1d95',
                    950: '#2e1065',
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'violet-mesh': 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 25%, #faf5ff 50%, #f0fdf4 75%, #f5f3ff 100%)',
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in-down': {
                    '0%': { opacity: '0', transform: 'translateY(-16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'scale-in': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'slide-in-right': {
                    '0%': { opacity: '0', transform: 'translateX(20px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                'shimmer': {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                'pulse-ring': {
                    '0%': { transform: 'scale(1)', opacity: '1' },
                    '100%': { transform: 'scale(1.4)', opacity: '0' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-6px)' },
                },
                'glow': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(124, 58, 237, 0)' },
                    '50%': { boxShadow: '0 0 20px 4px rgba(124, 58, 237, 0.15)' },
                },
                'count-up': {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.3s ease-out',
                'fade-in-up': 'fade-in-up 0.4s ease-out',
                'fade-in-up-slow': 'fade-in-up 0.6s ease-out',
                'fade-in-down': 'fade-in-down 0.3s ease-out',
                'scale-in': 'scale-in 0.2s ease-out',
                'slide-in-right': 'slide-in-right 0.3s ease-out',
                'shimmer': 'shimmer 2s linear infinite',
                'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
                'float': 'float 3s ease-in-out infinite',
                'glow': 'glow 2s ease-in-out infinite',
                'count-up': 'count-up 0.5s ease-out',
            },
            boxShadow: {
                'violet': '0 4px 24px -4px rgba(124, 58, 237, 0.2)',
                'violet-lg': '0 8px 40px -8px rgba(124, 58, 237, 0.25)',
                'violet-sm': '0 2px 8px -2px rgba(124, 58, 237, 0.12)',
                'card': '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.05)',
                'card-hover': '0 4px 16px -4px rgba(0,0,0,0.1), 0 2px 6px -2px rgba(0,0,0,0.06)',
            },
        },
    },
    plugins: [],
}
