'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Shield, User, Clock, Ban, PauseCircle, RefreshCw, MoreHorizontal } from 'lucide-react'
import { format } from 'date-fns'

function useCountdown(users: UserWithSub[]) {
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        const hasActive = users.some(
            (u) => u.subscription?.status === 'active' && u.subscription.expires_at
        )
        if (!hasActive) return

        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [users])

    return useCallback(
        (expiresAt: string) => {
            const diff = new Date(expiresAt).getTime() - now
            if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, text: 'Expired' }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24))
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((diff % (1000 * 60)) / 1000)

            return {
                expired: false,
                days,
                hours,
                minutes,
                seconds,
                text: `${days}h ${hours}j ${minutes}m ${seconds}d`,
            }
        },
        [now]
    )
}

interface UserWithSub {
    id: string
    name: string
    email: string
    role: string
    account_status?: string
    suspend_reason?: string
    suspended_until?: string
    ban_reason?: string
    created_at: string
    subscription: {
        status: string
        expires_at: string | null
    } | null
}

type ModalType = 'suspend' | 'ban' | 'recover' | null

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserWithSub[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)
    const getCountdown = useCountdown(users)

    // Modal state
    const [modalType, setModalType] = useState<ModalType>(null)
    const [selectedUser, setSelectedUser] = useState<UserWithSub | null>(null)
    const [submitting, setSubmitting] = useState(false)

    // Suspend form
    const [suspendDuration, setSuspendDuration] = useState('24')
    const [suspendUnit, setSuspendUnit] = useState('hours')
    const [suspendReason, setSuspendReason] = useState('')

    // Ban form
    const [banReason, setBanReason] = useState('')

    // Recover form
    const [newPassword, setNewPassword] = useState('')

    // Actions dropdown
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users')
            const result = await res.json()
            if (result.success) setUsers(result.data)
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchUsers() }, [])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClick = () => setOpenDropdown(null)
        if (openDropdown) {
            document.addEventListener('click', handleClick)
            return () => document.removeEventListener('click', handleClick)
        }
    }, [openDropdown])

    const handleRoleChange = async (userId: string, newRole: string) => {
        setUpdating(userId)
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, role: newRole }),
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            toast.success(`Role berhasil diubah ke ${newRole}`)
            await fetchUsers()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setUpdating(null)
        }
    }

    const openModal = (type: ModalType, user: UserWithSub) => {
        setModalType(type)
        setSelectedUser(user)
        setOpenDropdown(null)
        // Reset forms
        setSuspendDuration('24')
        setSuspendUnit('hours')
        setSuspendReason('')
        setBanReason('')
        setNewPassword('')
    }

    const closeModal = () => {
        setModalType(null)
        setSelectedUser(null)
    }

    const handleSuspend = async () => {
        if (!selectedUser || !suspendReason.trim()) {
            toast.error('Alasan suspen wajib diisi')
            return
        }

        const durationNum = parseFloat(suspendDuration) || 24
        const durationHours = suspendUnit === 'days' ? durationNum * 24 : durationNum

        setSubmitting(true)
        try {
            const res = await fetch('/api/admin/users/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'suspend',
                    user_id: selectedUser.id,
                    reason: suspendReason.trim(),
                    duration_hours: durationHours,
                }),
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            toast.success(`${selectedUser.name || selectedUser.email} berhasil di-suspend`)
            closeModal()
            await fetchUsers()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleBan = async () => {
        if (!selectedUser || !banReason.trim()) {
            toast.error('Alasan ban wajib diisi')
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch('/api/admin/users/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'ban',
                    user_id: selectedUser.id,
                    reason: banReason.trim(),
                }),
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            toast.success(`${selectedUser.name || selectedUser.email} berhasil di-ban`)
            closeModal()
            await fetchUsers()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleRecover = async () => {
        if (!selectedUser) return

        setSubmitting(true)
        try {
            const res = await fetch('/api/admin/users/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'recover',
                    user_id: selectedUser.id,
                    new_password: newPassword || undefined,
                }),
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            toast.success(result.message || `${selectedUser.name || selectedUser.email} berhasil di-recover`)
            closeModal()
            await fetchUsers()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const getStatusBadge = (user: UserWithSub) => {
        const status = user.account_status || 'active'
        if (status === 'suspended') {
            return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Suspended</Badge>
        }
        if (status === 'banned') {
            return <Badge variant="destructive">Banned</Badge>
        }
        return null
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Manage Users</h2>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">
                        {users.length} user terdaftar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Subscription</TableHead>
                                    <TableHead>Registered</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id} className={user.account_status === 'banned' ? 'opacity-60' : ''}>
                                        <TableCell className="font-medium">
                                            {user.name || '-'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {user.email}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                                {user.role === 'admin' ? (
                                                    <><Shield className="h-3 w-3 mr-1" />Admin</>
                                                ) : (
                                                    <><User className="h-3 w-3 mr-1" />User</>
                                                )}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(user) || (
                                                <span className="text-xs text-muted-foreground">Active</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.subscription ? (
                                                <div className="space-y-1">
                                                    <Badge
                                                        variant={
                                                            user.subscription.status === 'active'
                                                                ? 'default'
                                                                : user.subscription.status === 'pending'
                                                                    ? 'secondary'
                                                                    : 'destructive'
                                                        }
                                                        className={
                                                            user.subscription.status === 'active'
                                                                ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                                                : ''
                                                        }
                                                    >
                                                        {user.subscription.status}
                                                    </Badge>
                                                    {user.subscription.status === 'active' && user.subscription.expires_at && (() => {
                                                        const cd = getCountdown(user.subscription.expires_at)
                                                        return (
                                                            <div className={`flex items-center gap-1 text-xs font-mono ${cd.expired ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                                <Clock className="h-3 w-3" />
                                                                {cd.expired ? (
                                                                    <span>Expired</span>
                                                                ) : (
                                                                    <span>{cd.days}h {cd.hours}j {cd.minutes}m {cd.seconds}d</span>
                                                                )}
                                                            </div>
                                                        )
                                                    })()}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {format(new Date(user.created_at), 'dd MMM yyyy')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="relative inline-block">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setOpenDropdown(openDropdown === user.id ? null : user.id)
                                                    }}
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                                {openDropdown === user.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-50 py-1">
                                                        <button
                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                                                            disabled={updating === user.id}
                                                            onClick={() => {
                                                                setOpenDropdown(null)
                                                                handleRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin')
                                                            }}
                                                        >
                                                            <Shield className="h-3.5 w-3.5" />
                                                            {user.role === 'admin' ? 'Set User' : 'Set Admin'}
                                                        </button>
                                                        {(user.account_status || 'active') === 'active' && (
                                                            <>
                                                                <button
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-yellow-600"
                                                                    onClick={() => openModal('suspend', user)}
                                                                >
                                                                    <PauseCircle className="h-3.5 w-3.5" />
                                                                    Suspend Akun
                                                                </button>
                                                                <button
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-red-600"
                                                                    onClick={() => openModal('ban', user)}
                                                                >
                                                                    <Ban className="h-3.5 w-3.5" />
                                                                    Ban Akun
                                                                </button>
                                                            </>
                                                        )}
                                                        {(user.account_status === 'suspended') && (
                                                            <>
                                                                <button
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-red-600"
                                                                    onClick={() => openModal('ban', user)}
                                                                >
                                                                    <Ban className="h-3.5 w-3.5" />
                                                                    Ban Akun
                                                                </button>
                                                                <button
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-green-600"
                                                                    onClick={() => openModal('recover', user)}
                                                                >
                                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                                    Recovery Akun
                                                                </button>
                                                            </>
                                                        )}
                                                        {(user.account_status === 'banned') && (
                                                            <button
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-green-600"
                                                                onClick={() => openModal('recover', user)}
                                                            >
                                                                <RefreshCw className="h-3.5 w-3.5" />
                                                                Recovery Akun
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Suspend Modal */}
            <Dialog open={modalType === 'suspend'} onOpenChange={(open) => !open && closeModal()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-yellow-600">
                            <PauseCircle className="h-5 w-5" />
                            Suspend Akun
                        </DialogTitle>
                        <DialogDescription>
                            Suspend akun <strong>{selectedUser?.name || selectedUser?.email}</strong> untuk sementara waktu.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Durasi Suspend</label>
                            <div className="flex gap-2 mt-1">
                                <Input
                                    type="number"
                                    value={suspendDuration}
                                    onChange={(e) => setSuspendDuration(e.target.value)}
                                    min="1"
                                    className="flex-1"
                                />
                                <Select value={suspendUnit} onValueChange={setSuspendUnit}>
                                    <SelectTrigger className="w-24">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hours">Jam</SelectItem>
                                        <SelectItem value="days">Hari</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Alasan Suspend</label>
                            <Textarea
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                placeholder="Jelaskan alasan suspend akun ini..."
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeModal} disabled={submitting}>
                            Batal
                        </Button>
                        <Button
                            onClick={handleSuspend}
                            disabled={submitting || !suspendReason.trim()}
                            className="bg-yellow-600 hover:bg-yellow-700"
                        >
                            {submitting ? 'Memproses...' : 'Suspend Akun'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Ban Modal */}
            <Dialog open={modalType === 'ban'} onOpenChange={(open) => !open && closeModal()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Ban className="h-5 w-5" />
                            Ban Akun Permanen
                        </DialogTitle>
                        <DialogDescription>
                            Ban akun <strong>{selectedUser?.name || selectedUser?.email}</strong> secara permanen. User tidak akan bisa mengakses aplikasi.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Alasan Ban</label>
                            <Textarea
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                                placeholder="Jelaskan alasan ban akun ini..."
                                className="mt-1"
                            />
                        </div>
                        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                            Akun yang di-ban tidak bisa login. Admin bisa recovery akun ini nanti melalui menu Recovery.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeModal} disabled={submitting}>
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleBan}
                            disabled={submitting || !banReason.trim()}
                        >
                            {submitting ? 'Memproses...' : 'Ban Akun'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Recover Modal */}
            <Dialog open={modalType === 'recover'} onOpenChange={(open) => !open && closeModal()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600">
                            <RefreshCw className="h-5 w-5" />
                            Recovery Akun
                        </DialogTitle>
                        <DialogDescription>
                            Recovery akun <strong>{selectedUser?.name || selectedUser?.email}</strong>. Status akun akan kembali aktif.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedUser?.account_status === 'suspended' && selectedUser.suspend_reason && (
                            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm">
                                <span className="font-medium text-yellow-800">Alasan suspend: </span>
                                <span className="text-yellow-700">{selectedUser.suspend_reason}</span>
                            </div>
                        )}
                        {selectedUser?.account_status === 'banned' && selectedUser.ban_reason && (
                            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
                                <span className="font-medium text-red-800">Alasan ban: </span>
                                <span className="text-red-700">{selectedUser.ban_reason}</span>
                            </div>
                        )}
                        <div>
                            <label className="text-sm font-medium">Password Baru (opsional)</label>
                            <Input
                                type="text"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Kosongkan jika tidak ingin reset password"
                                className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Jika diisi, password user akan direset ke password baru ini.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeModal} disabled={submitting}>
                            Batal
                        </Button>
                        <Button
                            onClick={handleRecover}
                            disabled={submitting}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {submitting ? 'Memproses...' : 'Recovery Akun'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
