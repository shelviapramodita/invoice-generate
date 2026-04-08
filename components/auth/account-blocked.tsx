'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Ban, PauseCircle, LogOut, MessageSquare, Clock, CheckCircle, XCircle } from 'lucide-react'

interface AccountBlockedProps {
    profile: {
        account_status: string
        suspend_reason?: string
        suspended_until?: string
        ban_reason?: string
        name?: string
        email?: string
    }
}

export default function AccountBlocked({ profile }: AccountBlockedProps) {
    const router = useRouter()
    const [showAppealForm, setShowAppealForm] = useState(false)
    const [appealMessage, setAppealMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [existingAppeal, setExistingAppeal] = useState<any>(null)
    const [loadingAppeal, setLoadingAppeal] = useState(true)

    const isSuspended = profile.account_status === 'suspended'
    const isBanned = profile.account_status === 'banned'

    useEffect(() => {
        fetchExistingAppeal()
    }, [])

    const fetchExistingAppeal = async () => {
        try {
            const res = await fetch('/api/appeals')
            const result = await res.json()
            if (result.success && result.data?.length > 0) {
                // Get the latest appeal
                setExistingAppeal(result.data[0])
            }
        } catch (error) {
            console.error('Error fetching appeal:', error)
        } finally {
            setLoadingAppeal(false)
        }
    }

    const handleSubmitAppeal = async () => {
        if (appealMessage.trim().length < 10) {
            toast.error('Pesan banding minimal 10 karakter')
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch('/api/appeals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: appealMessage.trim() }),
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            toast.success('Banding berhasil dikirim! Admin akan segera merespons.')
            setShowAppealForm(false)
            setAppealMessage('')
            await fetchExistingAppeal()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleLogout = async () => {
        localStorage.removeItem('invoice_session_id')
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    // Countdown for suspension
    const getSuspendCountdown = () => {
        if (!profile.suspended_until) return null
        const diff = new Date(profile.suspended_until).getTime() - Date.now()
        if (diff <= 0) return 'Segera berakhir'
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        return `${days} hari ${hours} jam ${minutes} menit`
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 px-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardContent className="pt-8 pb-6 px-6 text-center">
                    {/* Icon */}
                    <div className={`h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isBanned ? 'bg-red-100' : 'bg-yellow-100'}`}>
                        {isBanned ? (
                            <Ban className="h-8 w-8 text-red-600" />
                        ) : (
                            <PauseCircle className="h-8 w-8 text-yellow-600" />
                        )}
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold mb-2">
                        {isBanned ? 'Akun Anda Di-Ban' : 'Akun Anda Di-Suspend'}
                    </h2>

                    {/* Reason */}
                    <div className={`rounded-lg p-3 mb-4 text-sm text-left ${isBanned ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <p className={`font-medium mb-1 ${isBanned ? 'text-red-800' : 'text-yellow-800'}`}>
                            Alasan:
                        </p>
                        <p className={isBanned ? 'text-red-700' : 'text-yellow-700'}>
                            {isBanned ? profile.ban_reason : profile.suspend_reason || 'Tidak ada keterangan'}
                        </p>
                    </div>

                    {/* Suspension duration */}
                    {isSuspended && profile.suspended_until && (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                            <Clock className="h-4 w-4" />
                            <span>Sisa waktu: {getSuspendCountdown()}</span>
                        </div>
                    )}

                    {isBanned && (
                        <p className="text-sm text-muted-foreground mb-4">
                            Ban bersifat permanen. Anda dapat mengajukan banding kepada admin.
                        </p>
                    )}

                    {/* Existing Appeal Status */}
                    {!loadingAppeal && existingAppeal && (
                        <div className="rounded-lg bg-muted/50 p-3 mb-4 text-left text-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-4 w-4" />
                                <span className="font-medium">Status Banding Anda:</span>
                                <Badge
                                    variant={
                                        existingAppeal.status === 'approved' ? 'default' :
                                        existingAppeal.status === 'rejected' ? 'destructive' : 'secondary'
                                    }
                                    className={existingAppeal.status === 'approved' ? 'bg-green-100 text-green-700' : ''}
                                >
                                    {existingAppeal.status === 'pending' ? 'Menunggu' :
                                     existingAppeal.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground">{existingAppeal.message}</p>
                            {existingAppeal.admin_response && (
                                <div className="mt-2 pt-2 border-t">
                                    <p className="text-xs font-medium text-muted-foreground">Respon admin:</p>
                                    <p>{existingAppeal.admin_response}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        {(!existingAppeal || existingAppeal.status !== 'pending') && (
                            <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => setShowAppealForm(true)}
                            >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Ajukan Banding
                            </Button>
                        )}
                        <Button
                            className="w-full"
                            variant="ghost"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Logout
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Appeal Form Dialog */}
            <Dialog open={showAppealForm} onOpenChange={setShowAppealForm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Ajukan Banding
                        </DialogTitle>
                        <DialogDescription>
                            Jelaskan mengapa akun Anda harus dipulihkan. Admin akan meninjau banding Anda.
                        </DialogDescription>
                    </DialogHeader>
                    <div>
                        <label className="text-sm font-medium">Pesan Banding</label>
                        <Textarea
                            value={appealMessage}
                            onChange={(e) => setAppealMessage(e.target.value)}
                            placeholder="Jelaskan alasan Anda mengajukan banding... (min. 10 karakter)"
                            className="mt-1 min-h-[120px]"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {appealMessage.length}/10 karakter minimum
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAppealForm(false)} disabled={submitting}>
                            Batal
                        </Button>
                        <Button
                            onClick={handleSubmitAppeal}
                            disabled={submitting || appealMessage.trim().length < 10}
                        >
                            {submitting ? 'Mengirim...' : 'Kirim Banding'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
