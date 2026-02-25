import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerApi, login, getMe, uploadPhoto } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'

type Step = 'info' | 'photo'

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
            // Log in immediately to get token
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

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                        <span className="text-white font-bold text-lg">GBU</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Create Student Account</h1>
                    <div className="flex items-center justify-center gap-2 mt-3">
                        {(['info', 'photo'] as Step[]).map((s, i) => (
                            <React.Fragment key={s}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step === s ? 'bg-blue-600 text-white' :
                                        (step === 'photo' && s === 'info') ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {(step === 'photo' && s === 'info') ? '✓' : i + 1}
                                </div>
                                {i === 0 && <div className="h-px w-8 bg-gray-300" />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    {step === 'info' ? (
                        <form onSubmit={handleInfoSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input type="text" required {...f('name')}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="John Doe" autoFocus />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">University Roll No.</label>
                                <input type="text" required {...f('universityRoll')}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="2021BCS001" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                <input type="text" required {...f('department')}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Computer Science" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input type="email" required {...f('email')}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="you@gbu.ac.in" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                    <input type="password" required minLength={8} {...f('password')}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm</label>
                                    <input type="password" required {...f('confirmPassword')}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <Button type="submit" loading={loading} className="w-full justify-center">
                                Continue
                            </Button>
                        </form>
                    ) : (
                        <div className="text-center space-y-5">
                            <div>
                                <h3 className="font-semibold text-gray-900">Upload Profile Photo</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Required for identity verification during exams. Use a clear, front-facing photo.
                                </p>
                            </div>
                            <div
                                onClick={() => fileRef.current?.click()}
                                className="mx-auto w-36 h-36 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 overflow-hidden bg-gray-50"
                            >
                                {photoPreview ? (
                                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center px-2">
                                        <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span className="text-xs text-gray-500 mt-1 block">Click to upload</span>
                                    </div>
                                )}
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            {photoPreview && (
                                <button onClick={() => fileRef.current?.click()}
                                    className="text-sm text-blue-600 hover:underline">Change photo</button>
                            )}
                            <Button onClick={handlePhotoSubmit} loading={loading} disabled={!photoFile} className="w-full justify-center">
                                Finish Setup
                            </Button>
                        </div>
                    )}

                    {step === 'info' && (
                        <p className="text-center text-sm text-gray-500 mt-6">
                            Already have an account?{' '}
                            <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
