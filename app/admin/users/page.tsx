'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Shield, User } from 'lucide-react'
import { format } from 'date-fns'

interface UserWithSub {
    id: string
    name: string
    email: string
    role: string
    created_at: string
    subscription: {
        status: string
        expires_at: string | null
    } | null
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserWithSub[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)

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
                                    <TableHead>Subscription</TableHead>
                                    <TableHead>Registered</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
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
                                            {user.subscription ? (
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
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {format(new Date(user.created_at), 'dd MMM yyyy')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={updating === user.id}
                                                onClick={() =>
                                                    handleRoleChange(
                                                        user.id,
                                                        user.role === 'admin' ? 'user' : 'admin'
                                                    )
                                                }
                                            >
                                                {updating === user.id
                                                    ? 'Updating...'
                                                    : user.role === 'admin'
                                                        ? 'Set User'
                                                        : 'Set Admin'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
