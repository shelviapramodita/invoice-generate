'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
    Check,
    Upload,
    Clock,
    XCircle,
    LogOut,
    FileText,
    Zap,
    Shield,
    CreditCard,
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

    if (isActive) {
        router.push('/')
        return null
    }

    const features = [
        { icon: FileText, text: 'Generate invoice PDF tanpa batas' },
        { icon: Zap, text: 'Upload Excel & auto-generate' },
        { icon: Shield, text: 'Akses history & edit invoice' },
        { icon: CreditCard, text: 'Download PDF, ZIP, & merge' },
    ]

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-white/80 backdrop-blur-sm">
                <div>
                    <h2 className="text-lg font-semibold">Invoice Generator</h2>
                    <p className="text-sm text-muted-foreground">
                        Hai, {profile?.name || profile?.email || 'User'}
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                </Button>
            </div>

            {/* Main Content - fills remaining height */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-4xl">
                    {/* Status Banner */}
                    {isPending && (
                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 flex items-center gap-3 mb-4">
                            <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
                            <div>
                                <span className="font-medium text-yellow-800">Menunggu Approval — </span>
                                <span className="text-sm text-yellow-700">Bukti pembayaran sedang diproses admin.</span>
                            </div>
                        </div>
                    )}
                    {isRejected && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center gap-3 mb-4">
                            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                            <div>
                                <span className="font-medium text-red-800">Ditolak — </span>
                                <span className="text-sm text-red-700">{subscription?.reject_reason || 'Bukti tidak valid. Silakan ajukan ulang.'}</span>
                            </div>
                        </div>
                    )}
                    {isExpired && (
                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 flex items-center gap-3 mb-4">
                            <Clock className="h-5 w-5 text-orange-600 shrink-0" />
                            <div>
                                <span className="font-medium text-orange-800">Expired — </span>
                                <span className="text-sm text-orange-700">Langganan berakhir. Silakan perpanjang.</span>
                            </div>
                        </div>
                    )}

                    {/* 2-Column Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left - Plan Info */}
                        <Card className="overflow-hidden shadow-md border-2">
                            <div className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground p-6 text-center">
                                <h1 className="text-xl font-bold mb-1">{config?.plan_name || 'Akses Penuh'}</h1>
                                <div className="text-4xl font-bold tracking-tight">
                                    {config ? formatCurrency(config.price) : 'Rp 50.000'}
                                </div>
                                <p className="text-primary-foreground/80 text-sm mt-1">
                                    / {config?.duration_days || 30} hari
                                </p>
                            </div>
                            <CardContent className="p-5">
                                <p className="text-sm text-muted-foreground mb-4">
                                    {config?.description || 'Akses semua fitur Invoice Generator tanpa batas.'}
                                </p>
                                <div className="space-y-2.5">
                                    {features.map((feature, i) => (
                                        <div key={i} className="flex items-center gap-2.5">
                                            <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                <Check className="h-3.5 w-3.5 text-green-600" />
                                            </div>
                                            <span className="text-sm">{feature.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Right - Payment Upload */}
                        {!isPending ? (
                            <Card className="shadow-md flex flex-col">
                                <CardContent className="p-5 flex flex-col flex-1">
                                    <h3 className="font-semibold text-base mb-1">Upload Bukti Pembayaran</h3>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        Transfer lalu upload bukti:
                                    </p>

                                    {/* Bank Info */}
                                    <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm mb-3">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Bank</span>
                                            <span className="font-medium">BCA</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">No. Rekening</span>
                                            <span className="font-mono font-medium">1234567890</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Atas Nama</span>
                                            <span className="font-medium">PT Invoice Generator</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Nominal</span>
                                            <span className="font-bold text-primary">
                                                {config ? formatCurrency(config.price) : 'Rp 50.000'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* File Upload */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                    />
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 min-h-[80px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors mb-3"
                                    >
                                        {selectedFile ? (
                                            <>
                                                <Check className="h-6 w-6 text-green-600 mb-1" />
                                                <p className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                                                <p className="text-xs text-muted-foreground">Klik untuk ganti</p>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                                                <p className="text-sm font-medium">Upload bukti transfer</p>
                                                <p className="text-xs text-muted-foreground">JPG, PNG, PDF (maks 5MB)</p>
                                            </>
                                        )}
                                    </div>

                                    <Button
                                        className="w-full"
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
                        ) : (
                            <Card className="shadow-md flex items-center justify-center">
                                <CardContent className="p-8 text-center">
                                    <div className="h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                                        <Clock className="h-8 w-8 text-yellow-600" />
                                    </div>
                                    <h3 className="font-semibold text-lg mb-2">Sedang Diproses</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Admin akan segera mereview bukti pembayaran Anda. Anda akan mendapat akses setelah disetujui.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
