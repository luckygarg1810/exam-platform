import React, { useEffect, useState } from 'react'
import { Layout } from '../../components/layout/Layout'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { CreateUserModal } from '../../components/ui/CreateUserModal'
import { listUsers, changeRole, deleteUser } from '../../api/users'
import { UserProfile, UserRole } from '../../types'
import toast from 'react-hot-toast'

export const AdminDashboard: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
    const [showRoleModal, setShowRoleModal] = useState(false)
    const [newRole, setNewRole] = useState<UserRole>('STUDENT')
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)

    const load = async (p = 0) => {
        setLoading(true)
        try {
            const res = await listUsers(search || undefined, p, 12)
            setUsers(res.content)
            setTotalPages(res.totalPages)
            setPage(p)
        } catch {
            toast.error('Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => load(0), 300)
        return () => clearTimeout(timer)
    }, [search])

    const handleChangeRole = async () => {
        if (!selectedUser) return
        try {
            await changeRole(selectedUser.id, newRole)
            toast.success(`Role changed to ${newRole}`)
            setShowRoleModal(false)
            setSelectedUser(null)
            load(page)
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to change role')
        }
    }

    const handleDeleteUser = async () => {
        if (!selectedUser) return
        try {
            await deleteUser(selectedUser.id)
            toast.success('User deactivated successfully')
            setShowDeleteModal(false)
            setSelectedUser(null)
            load(page)
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete user')
        }
    }

    const openRoleModal = (user: UserProfile) => {
        setSelectedUser(user)
        setNewRole(user.role)
        setShowRoleModal(true)
    }

    const openDeleteModal = (user: UserProfile) => {
        setSelectedUser(user)
        setShowDeleteModal(true)
    }

    const stats = {
        students: users.filter(u => u.role === 'STUDENT').length,
        teachers: users.filter(u => u.role === 'TEACHER').length,
        admins: users.filter(u => u.role === 'ADMIN').length,
    }

    return (
        <Layout>
            {/* Page header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-7 animate-fade-in-down">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 8.048M12 4.354A12 12 0 0112 20" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Administration</p>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">User Management</h1>
                        </div>
                    </div>
                    <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                        + Create User
                    </Button>
                </div>

                {/* Stat chips */}
                <div className="flex flex-wrap gap-3 mt-5">
                    {[
                        { label: 'Students', count: stats.students, color: 'bg-blue-50 border border-blue-200 text-blue-700' },
                        { label: 'Teachers', count: stats.teachers, color: 'bg-emerald-50 border border-emerald-200 text-emerald-700' },
                        { label: 'Admins', count: stats.admins, color: 'bg-violet-50 border border-violet-200 text-violet-700' },
                    ].map(s => (
                        <div key={s.label} className={`${s.color} rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-semibold`}>
                            <span className="text-xl font-black">{s.count}</span>
                            <span className="text-xs opacity-80">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div className="mt-5">
                    <input
                        type="text"
                        placeholder="Search users by name, email, department..."
                        className="input w-full"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Users table */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="text-center">
                        <Spinner size="lg" />
                        <p className="text-gray-400 text-sm mt-3">Loading users...</p>
                    </div>
                </div>
            ) : users.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 text-center py-20 shadow-card">
                    <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 8.048M12 4.354A12 12 0 0112 20" />
                        </svg>
                    </div>
                    <p className="text-gray-400 text-sm">No users found.</p>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{user.department || '—'}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <Badge
                                                    variant={user.role === 'ADMIN' ? 'purple' : user.role === 'TEACHER' ? 'green' : 'blue'}
                                                    label={user.role}
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm space-x-2">
                                                <button
                                                    onClick={() => openRoleModal(user)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                                >
                                                    Edit Role
                                                </button>
                                                <button
                                                    onClick={() => openDeleteModal(user)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                >
                                                    Deactivate
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-3 mt-8">
                            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => load(page - 1)}>← Previous</Button>
                            <span className="text-sm text-violet-600 font-semibold bg-violet-50 px-3 py-1.5 rounded-lg">Page {page + 1} / {totalPages}</span>
                            <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => load(page + 1)}>Next →</Button>
                        </div>
                    )}
                </>
            )}

            {/* Change Role Modal */}
            <Modal open={showRoleModal} onClose={() => setShowRoleModal(false)} title="Change User Role" size="sm">
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-gray-600 mb-2">Select new role for {selectedUser?.name}:</p>
                        <select
                            value={newRole}
                            onChange={e => setNewRole(e.target.value as UserRole)}
                            className="input w-full"
                        >
                            <option value="STUDENT">Student</option>
                            <option value="TEACHER">Teacher</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowRoleModal(false)}>Cancel</Button>
                        <Button onClick={handleChangeRole}>Change Role</Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Deactivate User" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Are you sure you want to deactivate <strong>{selectedUser?.name}</strong>? This action cannot be undone immediately.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteUser}>Deactivate</Button>
                    </div>
                </div>
            </Modal>

            {/* Create User Modal */}
            <CreateUserModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => load(0)}
            />
        </Layout>
    )
}

// ─── End of Admin Dashboard ────────────────────────────────────────────────────
