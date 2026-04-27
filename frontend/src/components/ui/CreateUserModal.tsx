import React, { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { createUser } from '../../api/users'
import toast from 'react-hot-toast'

interface CreateUserModalProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ open, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'TEACHER',
        department: '',
        mobileNumber: '',
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!formData.name.trim()) {
            toast.error('Name is required')
            return
        }
        if (!formData.email.trim()) {
            toast.error('Email is required')
            return
        }

        setLoading(true)
        try {
            await createUser(formData)
            toast.success(`${formData.role.toLowerCase()} created successfully`)
            setFormData({
                name: '',
                email: '',
                role: 'TEACHER',
                department: '',
                mobileNumber: '',
            })
            onClose()
            onSuccess()
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || 'Failed to create user'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Create New User" size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                    </label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder="John Doe"
                        disabled={loading}
                    />
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                    </label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder="john@example.com"
                        disabled={loading}
                    />
                </div>

                {/* Role */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role *
                    </label>
                    <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        disabled={loading}
                    >
                        <option value="TEACHER">Teacher</option>
                        <option value="STUDENT">Student</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                    {formData.role === 'TEACHER' && (
                        <p className="mt-2 text-xs text-violet-600 bg-violet-50 p-2 rounded-lg">
                            <span className="font-semibold">Note:</span> A temporary password will be automatically generated and emailed to the new teacher.
                        </p>
                    )}
                </div>

                {/* Department */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department (Optional)
                    </label>
                    <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder="Computer Science"
                        disabled={loading}
                    />
                </div>

                {/* Mobile Number */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mobile Number (Optional)
                    </label>
                    <input
                        type="tel"
                        name="mobileNumber"
                        value={formData.mobileNumber}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder="+91 9876543210"
                        disabled={loading}
                    />
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 justify-end pt-4">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={loading}
                        className="flex items-center gap-2"
                    >
                        {loading && <Spinner size="sm" />}
                        Create User
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
