'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
    Check,
    Upload,
    Clock,
    XCircle,
    LogOut,
    FileText,
    CreditCard,
    Shield,
    Zap,
} from 'lucide-react'

interface SubscriptionConfig {
    plan_name: string
    price: number
    duration_days: number
    description: string
}

interface Subscription {
    id: string
    status: 'pending' | 'active' | 'expired' | 'rejected'
    payment_proof_url: string
    submitted_at: string
    approved_at: string | null
    expires_at: string | null
    reject_reason: string | null
}

interface Profile {
    name: string
    email: string
    role: string
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount)
}

export default function SubscribePage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [config, setConfig] = useState<SubscriptionConfig | null>(null)
    const [subscription, setSubscription] = useState<Subscription | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const response = await fetch('/api/subscription')
            const result = await response.json()

            if (result.success) {
                setConfig(result.data.config)
                setSubscription(result.data.subscription)
                setProfile(result.data.profile)
            }
        } catch (error) {
            console.error('Error fetching subscription:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!selectedFile) {
            toast.error('Pilih file bukti pembayaran')
            return
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('payment_proof', selectedFile)

            const response = await fetch('/api/subscription', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || result.message || 'Failed')
            }

            toast.success('Bukti pembayaran berhasil diupload! Menunggu approval admin.')
            setSelectedFile(null)
            await fetchData()
        } catch (error: any) {
            toast.error(error.message || 'Gagal mengirim bukti pembayaran')
        } finally {
            setSubmitting(false)
        }
    }

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    const isPending = subscription?.status === 'pending'
    const isActive = subscription?.status === 'active' && subscription.expires_at && new Date(subscription.expires_at) > new Date()
    const isRejected = subscription?.status === 'rejected'
    const isExpired = subscription?.status === 'expired' || (subscription?.status === 'active' && subscription.expires_at && new Date(subscription.expires_at) <= new Date())

    // If active subscription, redirect to home
    if (isActive) {
        router.push('/')
        return null
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
            {/* Header */}
            <div className="container mx-auto px-4 py-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">Invoice Generator</h2>
                        <p className="text-sm text-muted-foreground">
                            Hai, {profile?.name || profile?.email}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                    </Button>
                </div>
            </div>

            <div className="container mx-auto px-4 pb-12">
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* Status Banner */}
                    {isPending && (
                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
                            <Clock className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-yellow-800">Menunggu Approval</p>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Bukti pembayaran Anda sedang diproses oleh admin. Anda akan mendapat akses setelah disetujui.
                                </p>
                            </div>
                        </div>
                    )}

                    {isRejected && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                            <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-red-800">Pengajuan Ditolak</p>
                                <p className="text-sm text-red-700 mt-1">
                                    {subscription?.reject_reason || 'Bukti pembayaran tidak valid. Silakan ajukan ulang.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {isExpired && (
                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
                            <Clock className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-orange-800">Langganan Expired</p>
                                <p className="text-sm text-orange-700 mt-1">
                                    Langganan Anda sudah berakhir. Silakan perpanjang untuk mengakses semua fitur.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Plan Card */}
                    <Card className="overflow-hidden shadow-lg border-2">
                        <div className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground p-8 text-center">
                            <h1 className="text-3xl font-bold mb-2">{config?.plan_name || 'Akses Penuh'}</h1>
                            <div className="text-5xl font-bold tracking-tight mb-2">
                                {config ? formatCurrency(config.price) : 'Rp 50.000'}
                            </div>
                            <p className="text-primary-foreground/80">
                                / {config?.duration_days || 30} hari
                            </p>
                        </div>
                        <CardContent className="p-6">
                            <p className="text-muted-foreground mb-6">
                                {config?.description || 'Akses semua fitur Invoice Generator tanpa batas.'}
                            </p>
                            <div className="space-y-3">
                                {[
                                    { icon: FileText, text: 'Generate invoice PDF tanpa batas' },
                                    { icon: Zap, text: 'Upload Excel & auto-generate' },
                                    { icon: Shield, text: 'Akses history & edit invoice' },
                                    { icon: CreditCard, text: 'Download PDF, ZIP, & merge' },
                                ].map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                            <Check className="h-4 w-4 text-green-600" />
                                        </div>
                                        <span className="text-sm">{feature.text}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Upload */}
                    {!isPending && (
                        <Card className="shadow-md">
                            <CardHeader>
                                <CardTitle className="text-lg">Upload Bukti Pembayaran</CardTitle>
                                <CardDescription>
                                    Transfer ke rekening berikut, lalu upload bukti pembayaran:
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Bank Info */}
                                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Bank</span>
                                        <span className="font-medium">BCA</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">No. Rekening</span>
                                        <span className="font-mono font-medium">1234567890</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Atas Nama</span>
                                        <span className="font-medium">PT Invoice Generator</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Nominal</span>
                                        <span className="font-bold text-primary">
                                            {config ? formatCurrency(config.price) : 'Rp 50.000'}
                                        </span>
                                    </div>
                                </div>

                                {/* File Upload */}
                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                    />
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                                    >
                                        {selectedFile ? (
                                            <div className="space-y-2">
                                                <Check className="h-8 w-8 text-green-600 mx-auto" />
                                                <p className="text-sm font-medium">{selectedFile.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Klik untuk ganti file
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                                                <p className="text-sm font-medium">Klik untuk upload bukti transfer</p>
                                                <p className="text-xs text-muted-foreground">
                                                    JPG, PNG, atau PDF (maks 5MB)
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-11"
                                    onClick={handleSubmit}
                                    disabled={!selectedFile || submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                                            Mengirim...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4 mr-2" />
                                            Kirim Bukti Pembayaran
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
