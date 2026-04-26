import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { updateProfile, uploadProfilePhoto } from '../../api/users'
import { getMe } from '../../api/auth'
import toast from 'react-hot-toast'

// ─── Icon helpers ─────────────────────────────────────────────────────────────
const Icon: React.FC<{ path: string; className?: string }> = ({ path, className = 'w-5 h-5' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
)

const ICONS = {
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
    id: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2',
    book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.746 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    department: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    camera: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
    shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    save: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
    back: 'M10 19l-7-7m0 0l7-7m-7 7h18',
}

const roleMeta: Record<string, { label: string; color: string; bg: string; gradient: string }> = {
    STUDENT: { label: 'Student', color: 'text-violet-700', bg: 'bg-violet-100', gradient: 'from-violet-500 to-purple-600' },
    PROCTOR: { label: 'Proctor', color: 'text-blue-700', bg: 'bg-blue-100', gradient: 'from-blue-500 to-indigo-600' },
    ADMIN: { label: 'Admin', color: 'text-rose-700', bg: 'bg-rose-100', gradient: 'from-rose-500 to-pink-600' },
}

interface ProfileField { icon: string; label: string; value: string | undefined; fieldKey: string; type?: string; editable?: boolean }

export const Profile: React.FC = () => {
    const navigate = useNavigate()
    const { user, setUser } = useAuthStore()
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const [form, setForm] = useState({
        name: user?.name ?? '',
        mobileNumber: user?.mobileNumber ?? '',
        fathersName: user?.fathersName ?? '',
        universityRoll: user?.universityRoll ?? '',
        department: user?.department ?? '',
        programme: user?.programme ?? '',
        yearOfAdmission: user?.yearOfAdmission?.toString() ?? '',
    })

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
        setUploadingPhoto(true)
        try {
            await uploadProfilePhoto(file)
            const updated = await getMe()
            setUser(updated)
            toast.success('Profile photo updated!')
        } catch {
            toast.error('Photo upload failed')
        } finally {
            setUploadingPhoto(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const updated = await updateProfile({
                name: form.name || undefined,
                mobileNumber: form.mobileNumber || undefined,
                fathersName: form.fathersName || undefined,
                universityRoll: form.universityRoll || undefined,
                department: form.department || undefined,
                programme: form.programme || undefined,
                yearOfAdmission: form.yearOfAdmission ? parseInt(form.yearOfAdmission) : undefined,
            })
            setUser(updated)
            setEditing(false)
            toast.success('Profile updated successfully!')
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => {
        setForm({
            name: user?.name ?? '',
            mobileNumber: user?.mobileNumber ?? '',
            fathersName: user?.fathersName ?? '',
            universityRoll: user?.universityRoll ?? '',
            department: user?.department ?? '',
            programme: user?.programme ?? '',
            yearOfAdmission: user?.yearOfAdmission?.toString() ?? '',
        })
        setEditing(false)
    }

    if (!user) return null

    const meta = roleMeta[user.role] ?? roleMeta.STUDENT
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

    // ── Info sections ──────────────────────────────────────────────────────────
    const personalFields: ProfileField[] = [
        { icon: ICONS.user, label: 'Full Name', value: form.name, fieldKey: 'name', editable: true },
        { icon: ICONS.mail, label: 'Email Address', value: user.email, fieldKey: 'email', editable: false },
        { icon: ICONS.phone, label: 'Mobile Number', value: form.mobileNumber, fieldKey: 'mobileNumber', type: 'tel', editable: true },
        { icon: ICONS.user, label: "Father's Name", value: form.fathersName, fieldKey: 'fathersName', editable: true },
    ]

    const academicFields: ProfileField[] = [
        { icon: ICONS.id, label: 'University Roll', value: form.universityRoll, fieldKey: 'universityRoll', editable: user.role === 'STUDENT' },
        { icon: ICONS.department, label: 'Department', value: form.department, fieldKey: 'department', editable: user.role === 'STUDENT' },
        { icon: ICONS.book, label: 'Programme', value: form.programme, fieldKey: 'programme', editable: user.role === 'STUDENT' },
        { icon: ICONS.calendar, label: 'Year of Admission', value: form.yearOfAdmission, fieldKey: 'yearOfAdmission', type: 'number', editable: user.role === 'STUDENT' },
    ]

    const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all'

    const FieldRow: React.FC<ProfileField> = ({ icon, label, value, fieldKey, type, editable }) => (
        <div className="flex items-start gap-4 py-4 border-b border-gray-50 last:border-0">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon path={icon} className="w-4 h-4 text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                {editing && editable ? (
                    <input
                        type={type ?? 'text'}
                        value={value ?? ''}
                        onChange={(e) => setForm(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                        className={inputCls}
                        placeholder={`Enter ${label.toLowerCase()}`}
                    />
                ) : (
                    <p className={`text-sm font-semibold ${value ? 'text-gray-900' : 'text-gray-300 italic'}`}>
                        {value || 'Not provided'}
                    </p>
                )}
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-purple-50/30">
            {/* ── Top bar ─────────────────────────────────────────────────────── */}
            <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        <Icon path={ICONS.back} className="w-4 h-4" />
                        Back
                    </button>
                    <div className="flex items-center gap-2">
                        <img src="/gbu-logo.png" alt="GBU Logo" className="w-7 h-7 object-contain" />
                        <span className="text-sm font-bold text-gray-700">My Profile</span>
                    </div>
                    {!editing ? (
                        <button
                            onClick={() => setEditing(true)}
                            className="flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl transition-all"
                        >
                            <Icon path={ICONS.edit} className="w-3.5 h-3.5" />
                            Edit Profile
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={handleCancel}
                                className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-all">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 px-4 py-1.5 rounded-xl transition-all shadow-sm shadow-violet-200 disabled:opacity-60">
                                {saving ? (
                                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                ) : <Icon path={ICONS.save} className="w-3.5 h-3.5" />}
                                Save Changes
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

                {/* ── Hero card ──────────────────────────────────────────────── */}
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${meta.gradient} p-px shadow-xl shadow-violet-200/40`}>
                    <div className="bg-white rounded-[calc(1rem-1px)] p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                                <div className={`w-28 h-28 rounded-2xl overflow-hidden ring-4 ring-white shadow-xl ${!user.profilePhotoUrl ? `bg-gradient-to-br ${meta.gradient}` : ''} flex items-center justify-center`}>
                                    {user.profilePhotoUrl ? (
                                        <img src={user.profilePhotoUrl} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-white font-black text-3xl">{initials}</span>
                                    )}
                                </div>
                                {/* Camera overlay */}
                                <button
                                    onClick={() => fileRef.current?.click()}
                                    disabled={uploadingPhoto}
                                    className="absolute -bottom-1.5 -right-1.5 w-9 h-9 bg-white rounded-xl shadow-lg border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-all group"
                                    title="Change photo"
                                >
                                    {uploadingPhoto ? (
                                        <svg className="animate-spin w-4 h-4 text-violet-500" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                    ) : <Icon path={ICONS.camera} className="w-4 h-4 text-gray-500 group-hover:text-violet-600 transition-colors" />}
                                </button>
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            </div>

                            {/* Name + role + stats */}
                            <div className="flex-1 text-center sm:text-left">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">{user.name}</h1>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${meta.bg} ${meta.color}`}>
                                        {meta.label}
                                    </span>
                                </div>
                                <p className="text-gray-500 text-sm">{user.email}</p>
                                {user.universityRoll && (
                                    <p className="text-violet-600 font-semibold text-sm mt-0.5">Roll: {user.universityRoll}</p>
                                )}

                                {/* Stats row */}
                                <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-4">
                                    {user.programme && (
                                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl px-4 py-2.5 border border-violet-100">
                                            <p className="text-xs text-gray-400 font-medium">Programme</p>
                                            <p className="text-sm font-bold text-gray-800">{user.programme}</p>
                                        </div>
                                    )}
                                    {user.yearOfAdmission && (
                                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl px-4 py-2.5 border border-violet-100">
                                            <p className="text-xs text-gray-400 font-medium">Batch</p>
                                            <p className="text-sm font-bold text-gray-800">{user.yearOfAdmission}</p>
                                        </div>
                                    )}
                                    {user.department && (
                                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl px-4 py-2.5 border border-violet-100">
                                            <p className="text-xs text-gray-400 font-medium">Department</p>
                                            <p className="text-sm font-bold text-gray-800">{user.department.split(' ').slice(0, 2).join(' ')}</p>
                                        </div>
                                    )}
                                    {user.yearOfAdmission && (
                                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl px-4 py-2.5 border border-violet-100">
                                            <p className="text-xs text-gray-400 font-medium">Admission Year</p>
                                            <p className="text-sm font-bold text-gray-800">{user.yearOfAdmission}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Verification badge */}
                            <div className="hidden sm:flex flex-col items-end gap-2">
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    {user.isActive ? 'Active Account' : 'Inactive'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Two-column grid ─────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Personal info */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2 bg-gradient-to-r from-violet-50/60 to-transparent">
                            <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
                                <Icon path={ICONS.user} className="w-4 h-4 text-violet-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Personal Information</h3>
                                <p className="text-xs text-gray-400">Basic contact details</p>
                            </div>
                        </div>
                        <div className="px-6">
                            {personalFields.map(f => <FieldRow key={f.fieldKey} {...f} />)}
                        </div>
                    </div>

                    {/* Academic info */}
                    {user.role === 'STUDENT' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2 bg-gradient-to-r from-violet-50/60 to-transparent">
                                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                                    <Icon path={ICONS.book} className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Academic Information</h3>
                                    <p className="text-xs text-gray-400">University & programme details</p>
                                </div>
                            </div>
                            <div className="px-6">
                                {academicFields.map(f => <FieldRow key={f.fieldKey} {...f} />)}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Security card ─────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2 bg-gradient-to-r from-violet-50/60 to-transparent">
                        <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Icon path={ICONS.shield} className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900">Account & Security</h3>
                            <p className="text-xs text-gray-400">Account status and account information</p>
                        </div>
                    </div>
                    <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Account Status</p>
                            <div className={`flex items-center gap-1.5 font-bold text-sm ${user.isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                                <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                {user.isActive ? 'Active' : 'Inactive'}
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Role</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${meta.bg} ${meta.color}`}>
                                {meta.label}
                            </span>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Admission Year</p>
                            <p className="text-sm font-bold text-gray-800">
                                {user.yearOfAdmission ?? '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Editing footer hint ─────────────────────────────────────── */}
                {editing && (
                    <div className="text-center">
                        <p className="text-xs text-gray-400">
                            Click <span className="font-semibold text-violet-600">Save Changes</span> at the top when you're done editing.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
