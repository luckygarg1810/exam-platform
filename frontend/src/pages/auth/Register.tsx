import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerApi, login, getMe, uploadPhoto } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'

type Step = 'info' | 'photo'

const StepIndicator: React.FC<{ current: Step }> = ({ current }) => (
    <div className="flex items-center justify-center gap-3 mt-4">
        {(['info', 'photo'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
                <div className="flex items-center gap-2">
                    <div className={[
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                        current === s
                            ? 'bg-violet-600 text-white shadow-sm'
                            : (current === 'photo' && s === 'info')
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-400',
                    ].join(' ')}>
                        {(current === 'photo' && s === 'info') ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${current === s ? 'text-gray-800' :
                            (current === 'photo' && s === 'info') ? 'text-emerald-600' :
                                'text-gray-400'
                        }`}>{s === 'info' ? 'Details' : 'Photo'}</span>
                </div>
                {i === 0 && (
                    <div className={`flex-1 h-px max-w-[48px] transition-all duration-500 ${current === 'photo' ? 'bg-emerald-400' : 'bg-gray-200'
                        }`} />
                )}
            </React.Fragment>
        ))}
    </div>
)

export const Register: React.FC = () => {
    const navigate = useNavigate()
    const { setAuth } = useAuthStore()
    const [step, setStep] = useState<Step>('info')
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        name: '', email: '', password: '', confirmPassword: '',
        universityRoll: '', department: '',
    })
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleInfoSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (form.password !== form.confirmPassword) {
            toast.error('Passwords do not match'); return
        }
        if (form.password.length < 8) {
            toast.error('Password must be at least 8 characters'); return
        }
        setLoading(true)
        try {
            await registerApi({
                name: form.name, email: form.email, password: form.password,
                universityRoll: form.universityRoll, department: form.department,
            })
            const res = await login({ email: form.email, password: form.password })
            localStorage.setItem('accessToken', res.accessToken)
            localStorage.setItem('refreshToken', res.refreshToken)
            const user = await getMe()
            setAuth(user, res.accessToken, res.refreshToken)
            setStep('photo')
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
        setPhotoFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const handlePhotoSubmit = async () => {
        if (!photoFile) { toast.error('Please select a profile photo'); return }
        setLoading(true)
        try {
            await uploadPhoto(photoFile, false)
            toast.success('Welcome! Your account is ready.')
            navigate('/student', { replace: true })
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Photo upload failed')
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
                {/* Logo + step */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-violet-600 to-purple-600 rounded-2xl shadow-md">
                        <span className="text-white font-black text-lg tracking-tight">GBU</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mt-4 tracking-tight">Create Account</h1>
                    <p className="text-gray-500 text-sm mt-1">Start your journey at GBU Exam Platform</p>
                    <StepIndicator current={step} />
                </div>

                {/* Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-card">
                    {step === 'info' ? (
                        <form onSubmit={handleInfoSubmit} className="space-y-4">
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
                                className="w-full py-3 mt-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 text-sm flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Creating...</>
                                ) : 'Continue'}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center space-y-5 animate-fade-in-up">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Upload Profile Photo</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Required for identity verification during exams.
                                </p>
                            </div>
                            <div
                                onClick={() => fileRef.current?.click()}
                                className={[
                                    'mx-auto w-36 h-36 rounded-full cursor-pointer overflow-hidden transition-all duration-200',
                                    photoPreview
                                        ? 'ring-4 ring-violet-500 shadow-md'
                                        : 'border-2 border-dashed border-gray-300 hover:border-violet-400 bg-gray-50 hover:bg-violet-50/30 flex items-center justify-center',
                                ].join(' ')}
                            >
                                {photoPreview ? (
                                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center px-2 py-8">
                                        <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span className="text-xs text-gray-400 mt-2 block">Click to upload</span>
                                    </div>
                                )}
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            {photoPreview && (
                                <button onClick={() => fileRef.current?.click()}
                                    className="text-xs text-violet-600 hover:text-violet-800 transition-colors underline">Change photo</button>
                            )}
                            <button
                                onClick={handlePhotoSubmit}
                                disabled={!photoFile || loading}
                                className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Finishing...</>
                                ) : 'Finish Setup →'}
                            </button>
                        </div>
                    )}

                    {step === 'info' && (
                        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                            <p className="text-sm text-gray-500">
                                Already have an account?{' '}
                                <Link to="/login" className="text-violet-600 font-semibold hover:text-violet-800 transition-colors underline underline-offset-2">Sign in</Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
