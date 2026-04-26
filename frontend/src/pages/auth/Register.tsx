import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerApi, getMe } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = ['Account', 'Personal', 'Academic'] as const

const inputClass =
    'w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 hover:border-gray-300 transition-all'

const selectClass =
    'w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 hover:border-gray-300 transition-all appearance-none'

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
        {children}
        {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
)

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i)

const PROGRAMMES = [
    'B.Tech', 'M.Tech', 'BCA', 'MCA', 'B.Sc', 'M.Sc',
    'B.Com', 'M.Com', 'BBA', 'MBA', 'B.A.', 'M.A.',
    'B.Pharma', 'M.Pharma', 'LLB', 'LLM', 'B.Ed', 'M.Ed', 'PhD', 'Other',
]

const DEPARTMENTS = [
    'Computer Science & Engineering', 'Electronics & Communication',
    'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering',
    'Information Technology', 'Biotechnology', 'Chemistry',
    'Physics', 'Mathematics', 'Management Studies',
    'Commerce', 'Law', 'Education', 'Pharmacy', 'Other',
]

export const Register: React.FC = () => {
    const navigate = useNavigate()
    const { setAuth } = useAuthStore()
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState(0)

    const [form, setForm] = useState({
        // Step 0 – Account
        email: '', password: '', confirmPassword: '',
        // Step 1 – Personal
        name: '', mobileNumber: '', fathersName: '',
        // Step 2 – Academic
        universityRoll: '', department: '', programme: '', yearOfAdmission: '',
    })

    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const set = (field: keyof typeof form) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => setForm(prev => ({ ...prev, [field]: e.target.value }))

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
        setPhotoFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    // Per-step validation
    const validateStep = () => {
        if (step === 0) {
            if (!form.email) { toast.error('Email is required'); return false }
            if (!form.password || form.password.length < 8) { toast.error('Password must be at least 8 chars'); return false }
            if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return false }
            if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(form.password)) {
                toast.error('Password must have uppercase, lowercase and a digit'); return false
            }
        }
        if (step === 1) {
            if (!form.name) { toast.error('Full name is required'); return false }
            if (!form.mobileNumber) { toast.error('Mobile number is required'); return false }
            if (!/^[6-9]\d{9}$/.test(form.mobileNumber)) { toast.error('Enter a valid 10-digit mobile number'); return false }
            if (!photoFile) { toast.error('Profile photo is required'); return false }
        }
        if (step === 2) {
            if (!form.universityRoll) { toast.error('University roll number is required'); return false }
            if (!form.department) { toast.error('Department is required'); return false }
            if (!form.programme) { toast.error('Programme is required'); return false }
            if (!form.yearOfAdmission) { toast.error('Year of admission is required'); return false }
        }
        return true
    }

    const next = () => { if (validateStep()) setStep(s => s + 1) }
    const back = () => setStep(s => s - 1)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validateStep()) return

        const fd = new FormData()
        fd.append('name', form.name)
        fd.append('email', form.email)
        fd.append('password', form.password)
        fd.append('universityRoll', form.universityRoll)
        fd.append('department', form.department)
        fd.append('mobileNumber', form.mobileNumber)
        fd.append('fathersName', form.fathersName)
        fd.append('programme', form.programme)
        fd.append('yearOfAdmission', form.yearOfAdmission)
        fd.append('photo', photoFile!)

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/40 flex items-center justify-center px-4 py-10">
            <div className="max-w-lg w-full animate-fade-in-up">

                {/* Logo */}
                <div className="text-center mb-7">
                    <div className="inline-flex items-center justify-center">
                        <img src="/gbu-logo.png" alt="GBU Logo" className="w-16 h-16 object-contain" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mt-4 tracking-tight">Create Account</h1>
                    <p className="text-gray-500 text-sm mt-1">Student registration · GBU Exam Platform</p>
                </div>

                {/* Step progress */}
                <div className="flex items-center gap-2 mb-6">
                    {STEPS.map((label, i) => (
                        <React.Fragment key={i}>
                            <div className="flex items-center gap-2 flex-1">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${i < step ? 'bg-violet-600 text-white shadow-sm shadow-violet-300'
                                    : i === step ? 'bg-violet-600 text-white ring-4 ring-violet-200 shadow-sm shadow-violet-300'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}>
                                    {i < step ? (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : i + 1}
                                </div>
                                <span className={`text-xs font-semibold ${i === step ? 'text-violet-700' : i < step ? 'text-violet-500' : 'text-gray-400'}`}>
                                    {label}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${i < step ? 'bg-violet-500' : 'bg-gray-200'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-xl shadow-gray-100/70">
                    <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); next() }}>

                        {/* ── STEP 0: Account ── */}
                        {step === 0 && (
                            <div className="space-y-4">
                                <div className="mb-1">
                                    <h2 className="text-base font-bold text-gray-900">Account Details</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">Your login credentials</p>
                                </div>
                                <div>
                                    <Label required>Email Address</Label>
                                    <input type="email" required value={form.email} onChange={set('email')}
                                        className={inputClass} placeholder="you@gbu.ac.in" autoFocus />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label required>Password</Label>
                                        <input type="password" required minLength={8} value={form.password} onChange={set('password')}
                                            className={inputClass} placeholder="min 8 chars" />
                                    </div>
                                    <div>
                                        <Label required>Confirm</Label>
                                        <input type="password" required value={form.confirmPassword} onChange={set('confirmPassword')}
                                            className={inputClass} placeholder="repeat" />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                                    Password must be at least 8 characters with uppercase, lowercase, and a digit.
                                </p>
                            </div>
                        )}

                        {/* ── STEP 1: Personal ── */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="mb-1">
                                    <h2 className="text-base font-bold text-gray-900">Personal Details</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">Tell us about yourself</p>
                                </div>

                                {/* Photo picker */}
                                <div className="flex items-center gap-5 p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100">
                                    <div
                                        onClick={() => fileRef.current?.click()}
                                        className={`w-20 h-20 rounded-full cursor-pointer overflow-hidden flex-shrink-0 transition-all duration-200 ${photoPreview
                                            ? 'ring-4 ring-violet-500 shadow-lg'
                                            : 'border-2 border-dashed border-violet-300 hover:border-violet-500 bg-white flex items-center justify-center'
                                            }`}
                                    >
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <svg className="w-8 h-8 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">Profile Photo <span className="text-red-400">*</span></p>
                                        <p className="text-xs text-gray-500 mt-0.5">Used for identity verification during exams</p>
                                        <button type="button" onClick={() => fileRef.current?.click()}
                                            className="mt-2 text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors bg-white px-3 py-1 rounded-lg border border-violet-200 hover:border-violet-400">
                                            {photoPreview ? 'Change Photo' : 'Upload Photo'}
                                        </button>
                                    </div>
                                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                </div>

                                <div>
                                    <Label required>Full Name</Label>
                                    <input type="text" required value={form.name} onChange={set('name')}
                                        className={inputClass} placeholder="As per university records" autoFocus />
                                </div>
                                <div>
                                    <Label>Father's Name</Label>
                                    <input type="text" value={form.fathersName} onChange={set('fathersName')}
                                        className={inputClass} placeholder="Father's full name" />
                                </div>
                                <div>
                                    <Label required>Mobile Number</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">+91</span>
                                        <input type="tel" required maxLength={10} value={form.mobileNumber} onChange={set('mobileNumber')}
                                            className={`${inputClass} pl-12`} placeholder="10-digit mobile" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── STEP 2: Academic ── */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="mb-1">
                                    <h2 className="text-base font-bold text-gray-900">Academic Details</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">Your university information</p>
                                </div>
                                <div>
                                    <Label required>University Roll Number</Label>
                                    <input type="text" required value={form.universityRoll} onChange={set('universityRoll')}
                                        className={inputClass} placeholder="e.g. 2021BCS001" autoFocus />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label required>Programme</Label>
                                        <div className="relative">
                                            <select required value={form.programme} onChange={set('programme')} className={selectClass}>
                                                <option value="">Select</option>
                                                {PROGRAMMES.map(p => <option key={p}>{p}</option>)}
                                            </select>
                                            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div>
                                        <Label required>Year of Admission</Label>
                                        <div className="relative">
                                            <select required value={form.yearOfAdmission} onChange={set('yearOfAdmission')} className={selectClass}>
                                                <option value="">Select year</option>
                                                {YEARS.map(y => <option key={y}>{y}</option>)}
                                            </select>
                                            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <Label required>Department</Label>
                                    <div className="relative">
                                        <select required value={form.department} onChange={set('department')} className={selectClass}>
                                            <option value="">Select department</option>
                                            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                                        </select>
                                        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation buttons */}
                        <div className={`flex gap-3 mt-6 ${step > 0 ? 'justify-between' : 'justify-end'}`}>
                            {step > 0 && (
                                <button type="button" onClick={back}
                                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all">
                                    ← Back
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-sm shadow-violet-200 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 text-sm flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Creating account...</>
                                ) : step < 2 ? 'Continue →' : 'Create Account →'}
                            </button>
                        </div>
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
