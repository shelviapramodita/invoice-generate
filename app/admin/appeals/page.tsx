'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { toast } from 'sonner'
import { MessageSquare, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'

interface Appeal {
    id: string
    user_id: string
    appeal_type: 'suspended' | 'banned'
    message: string
    status: 'pending' | 'approved' | 'rejected'
    admin_response: string | null
    created_at: string
    responded_at: string | null
    profiles?: {
        name: string
        email: string
    }
}

export default function AdminAppealsPage() {
    const [appeals, setAppeals] = useState<Appeal[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null)
    const [responseText, setResponseText] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [actionType, setActionType] = useState<'approved' | 'rejected' | null>(null)

    const fetchAppeals = async () => {
        try {
            const res = await fetch('/api/appeals')
            const result = await res.json()
            if (result.success) setAppeals(result.data || [])
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchAppeals() }, [])

    const handleRespond = async (status: 'approved' | 'rejected') => {
        if (!selectedAppeal) return

        setSubmitting(true)
        try {
            const res = await fetch('/api/appeals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appeal_id: selectedAppeal.id,
                    status,
                    admin_response: responseText.trim() || null,
                }),
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            toast.success(status === 'approved' ? 'Banding disetujui, akun di-recover' : 'Banding ditolak')
            setSelectedAppeal(null)
            setResponseText('')
            setActionType(null)
            await fetchAppeals()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const pendingCount = appeals.filter(a => a.status === 'pending').length

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Banding User</h2>
                {pendingCount > 0 && (
                    <Badge variant="destructive">{pendingCount} pending</Badge>
                )}
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">
                        {appeals.length} banding
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : appeals.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Belum ada banding dari user</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead>Pesan</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {appeals.map((appeal) => (
                                    <TableRow key={appeal.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium text-sm">{appeal.profiles?.name || '-'}</p>
                                                <p className="text-xs text-muted-foreground">{appeal.profiles?.email}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={appeal.appeal_type === 'banned' ? 'destructive' : 'secondary'}
                                                className={appeal.appeal_type === 'suspended' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' : ''}
                                            >
                                                {appeal.appeal_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            <p className="text-sm truncate">{appeal.message}</p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    appeal.status === 'approved' ? 'default' :
                                                    appeal.status === 'rejected' ? 'destructive' : 'secondary'
                                                }
                                                className={appeal.status === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                                            >
                                                {appeal.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {format(new Date(appeal.created_at), 'dd MMM yyyy HH:mm')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedAppeal(appeal)
                                                    setResponseText(appeal.admin_response || '')
                                                }}
                                            >
                                                {appeal.status === 'pending' ? 'Review' : 'Detail'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Appeal Detail Modal */}
            <Dialog open={!!selectedAppeal} onOpenChange={(open) => { if (!open) { setSelectedAppeal(null); setActionType(null) } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Detail Banding
                        </DialogTitle>
                        <DialogDescription>
                            Banding dari <strong>{selectedAppeal?.profiles?.name || selectedAppeal?.profiles?.email}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Badge
                                variant={selectedAppeal?.appeal_type === 'banned' ? 'destructive' : 'secondary'}
                                className={selectedAppeal?.appeal_type === 'suspended' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' : ''}
                            >
                                {selectedAppeal?.appeal_type}
                            </Badge>
                            <Badge
                                variant={
                                    selectedAppeal?.status === 'approved' ? 'default' :
                                    selectedAppeal?.status === 'rejected' ? 'destructive' : 'secondary'
                                }
                                className={selectedAppeal?.status === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                            >
                                {selectedAppeal?.status}
                            </Badge>
                        </div>

                        <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Pesan dari user:</p>
                            <p className="text-sm">{selectedAppeal?.message}</p>
                        </div>

                        {selectedAppeal?.status === 'pending' && (
                            <div>
                                <label className="text-sm font-medium">Respon Admin (opsional)</label>
                                <Textarea
                                    value={responseText}
                                    onChange={(e) => setResponseText(e.target.value)}
                                    placeholder="Tulis respon untuk user..."
                                    className="mt-1"
                                />
                            </div>
                        )}

                        {selectedAppeal?.admin_response && selectedAppeal.status !== 'pending' && (
                            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                                <p className="text-xs font-medium text-blue-800 mb-1">Respon admin:</p>
                                <p className="text-sm text-blue-700">{selectedAppeal.admin_response}</p>
                            </div>
                        )}
                    </div>

                    {selectedAppeal?.status === 'pending' && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => { setSelectedAppeal(null); setActionType(null) }}
                                disabled={submitting}
                            >
                                Batal
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => handleRespond('rejected')}
                                disabled={submitting}
                            >
                                <XCircle className="h-4 w-4 mr-1" />
                                {submitting ? 'Memproses...' : 'Tolak'}
                            </Button>
                            <Button
                                onClick={() => handleRespond('approved')}
                                disabled={submitting}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {submitting ? 'Memproses...' : 'Setujui & Recovery'}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
