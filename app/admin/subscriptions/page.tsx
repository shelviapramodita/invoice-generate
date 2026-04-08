'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Check, X, Eye, ImageIcon } from 'lucide-react'
import { format } from 'date-fns'

interface Subscription {
    id: string
    user_id: string
    status: 'pending' | 'active' | 'expired' | 'rejected'
    payment_proof_url: string
    submitted_at: string
    approved_at: string | null
    expires_at: string | null
    reject_reason: string | null
    created_at: string
    user: { name: string; email: string }
}

export default function AdminSubscriptionsPage() {
    const [subs, setSubs] = useState<Subscription[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>('all')

    // Reject dialog
    const [rejectId, setRejectId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState('')

    // Proof preview
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewIsPdf, setPreviewIsPdf] = useState(false)

    const fetchSubs = async () => {
        try {
            const res = await fetch('/api/admin/subscriptions')
            const result = await res.json()
            if (result.success) setSubs(result.data)
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchSubs() }, [])

    const handleApprove = async (subId: string) => {
        setProcessing(subId)
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription_id: subId, action: 'approve' }),
            })

            if (!res.ok) throw new Error('Failed to approve')
            toast.success('Subscription disetujui!')
            await fetchSubs()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async () => {
        if (!rejectId) return
        setProcessing(rejectId)
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription_id: rejectId,
                    action: 'reject',
                    reject_reason: rejectReason,
                }),
            })

            if (!res.ok) throw new Error('Failed to reject')
            toast.success('Subscription ditolak')
            setRejectId(null)
            setRejectReason('')
            await fetchSubs()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setProcessing(null)
        }
    }

    const handleViewProof = async (path: string) => {
        try {
            const res = await fetch(`/api/admin/payment-proof?path=${encodeURIComponent(path)}`)
            const data = await res.json()

            if (data.success && data.url) {
                setPreviewIsPdf(path.toLowerCase().endsWith('.pdf'))
                setPreviewUrl(data.url)
            } else {
                toast.error('Gagal memuat bukti pembayaran')
            }
        } catch (error) {
            toast.error('Gagal memuat bukti pembayaran')
        }
    }

    const filtered = filterStatus === 'all'
        ? subs
        : subs.filter(s => s.status === filterStatus)

    const statusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 hover:bg-green-100'
            case 'pending': return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
            case 'rejected': return 'bg-red-100 text-red-700 hover:bg-red-100'
            case 'expired': return 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            default: return ''
        }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Manage Subscriptions</h2>

            {/* Filter */}
            <div className="flex gap-2">
                {['all', 'pending', 'active', 'rejected', 'expired'].map((status) => (
                    <Button
                        key={status}
                        variant={filterStatus === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterStatus(status)}
                    >
                        {status === 'all' ? 'Semua' : status}
                        {status === 'pending' && subs.filter(s => s.status === 'pending').length > 0 && (
                            <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-white text-xs">
                                {subs.filter(s => s.status === 'pending').length}
                            </span>
                        )}
                    </Button>
                ))}
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">
                        {filtered.length} subscription
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">
                            Tidak ada subscription
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Bukti</TableHead>
                                    <TableHead>Submitted</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((sub) => (
                                    <TableRow key={sub.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium text-sm">{sub.user?.name || '-'}</p>
                                                <p className="text-xs text-muted-foreground">{sub.user?.email}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={statusColor(sub.status)}>
                                                {sub.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {sub.payment_proof_url ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewProof(sub.payment_proof_url)}
                                                    className="gap-1.5"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    Lihat
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {format(new Date(sub.submitted_at), 'dd MMM yyyy HH:mm')}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {sub.expires_at
                                                ? format(new Date(sub.expires_at), 'dd MMM yyyy')
                                                : '-'
                                            }
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {sub.status === 'pending' && (
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 gap-1"
                                                        onClick={() => handleApprove(sub.id)}
                                                        disabled={processing === sub.id}
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="gap-1"
                                                        onClick={() => setRejectId(sub.id)}
                                                        disabled={processing === sub.id}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Reject Dialog */}
            <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tolak Subscription</DialogTitle>
                        <DialogDescription>
                            Berikan alasan penolakan (opsional)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Alasan penolakan..."
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setRejectId(null)}>
                                Batal
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleReject}
                                disabled={processing !== null}
                            >
                                Tolak
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Payment Proof Preview */}
            <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
                <DialogContent className="!max-w-[95vw] w-[95vw] h-[92vh] max-h-[92vh] p-4 flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ImageIcon className="h-5 w-5" />
                            Bukti Pembayaran
                        </DialogTitle>
                    </DialogHeader>
                    {previewUrl && (
                        <div className="flex-1 min-h-0">
                            {previewIsPdf ? (
                                <iframe
                                    src={previewUrl}
                                    className="w-full h-full rounded-lg border"
                                    title="Bukti Pembayaran"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center overflow-auto">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={previewUrl}
                                        alt="Bukti Pembayaran"
                                        className="max-w-full max-h-full rounded-lg object-contain"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
