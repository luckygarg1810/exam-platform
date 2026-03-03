import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerApi, getMe } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

export const Register: React.FC = () => {
    const navigate = useNavigate()
    const { setAuth } = useAuthStore()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        name: '', email: '', password: '', confirmPassword: '',
        universityRoll: '', department: '',
    })
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
        setPhotoFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return }
        if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
        if (!photoFile) { toast.error('Profile photo is required'); return }

        const fd = new FormData()
        fd.append('name', form.name)
        fd.append('email', form.email)
        fd.append('password', form.password)
        fd.append('universityRoll', form.universityRoll)
        fd.append('department', form.department)
        fd.append('photo', photoFile)

        setLoading(true)
        try {
            const res = await registerApi(fd)
            localStorage.setItem('accessToken', res.accessToken)
            localStorage.setItem('refreshToken', res.refreshToken)
            const user = await getMe()
            setAuth(user, res.accessToken, res.refreshToken)
            toast.success('Welcome to GBU Exam Platform!')
            navigate('/student', { replace: true })
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    const f = (field: keyof typeof form) => ({
        value: form[field],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setForm(prev => ({ ...prev, [field]: e.target.value })),
    })

    const inputClass = "w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 hover:border-gray-300 transition-all"

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
            <div className="max-w-md w-full animate-fade-in-up">
                {/* Logo */}
                <div className="text-center mb-7">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-violet-600 to-purple-600 rounded-2xl shadow-md">
                        <span className="text-white font-black text-lg tracking-tight">GBU</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mt-4 tracking-tight">Create Account</h1>
                    <p className="text-gray-500 text-sm mt-1">Student registration · GBU Exam Platform</p>
                </div>

                {/* Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-card">
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* ── Profile photo picker ── */}
                        <div className="flex flex-col items-center gap-2 pb-3 border-b border-gray-100">
                            <div
                                onClick={() => fileRef.current?.click()}
                                className={[
                                    'w-24 h-24 rounded-full cursor-pointer overflow-hidden transition-all duration-200',
                                    photoPreview
                                        ? 'ring-4 ring-violet-500 shadow-lg'
                                        : 'border-2 border-dashed border-gray-300 hover:border-violet-400 bg-gray-50 hover:bg-violet-50/30 flex items-center justify-center',
                                ].join(' ')}
                            >
                                {photoPreview ? (
                                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-1 w-full h-full">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className={`text-xs font-semibold transition-colors ${photoPreview ? 'text-violet-600 hover:text-violet-800' : 'text-violet-500 hover:text-violet-700'}`}
                            >
                                {photoPreview ? 'Change photo' : 'Upload profile photo'}
                                {!photoPreview && <span className="text-red-400 ml-0.5">*</span>}
                            </button>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                        </div>

                        {/* ── Fields ── */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Full Name</label>
                            <input type="text" required {...f('name')} className={inputClass} placeholder="John Doe" autoFocus />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Roll No.</label>
                                <input type="text" required {...f('universityRoll')} className={inputClass} placeholder="2021BCS001" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Department</label>
                                <input type="text" required {...f('department')} className={inputClass} placeholder="CSE" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Email</label>
                            <input type="email" required {...f('email')} className={inputClass} placeholder="you@gbu.ac.in" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Password</label>
                                <input type="password" required minLength={8} {...f('password')} className={inputClass} placeholder="min 8 chars" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Confirm</label>
                                <input type="password" required {...f('confirmPassword')} className={inputClass} placeholder="repeat" />
                            </div>
                        </div>

                        <button
                            type="submit" disabled={loading}
                            className="w-full py-2.5 mt-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 text-sm flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Creating account...</>
                            ) : 'Create Account →'}
                        </button>
                    </form>

                    <div className="mt-5 pt-5 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-500">
                            Already have an account?{' '}
                            <Link to="/login" className="text-violet-600 font-semibold hover:text-violet-700 transition-colors">Sign in</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
