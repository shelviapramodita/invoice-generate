'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Save, Plus, Trash2, Check, Upload, Eye, EyeOff } from 'lucide-react'

interface Config {
    plan_name: string
    price: number
    duration_days: number
    description: string
    bank_name: string
    bank_account_number: string
    bank_account_holder: string
    features: string[]
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount)
}

export default function AdminSettingsPage() {
    const [config, setConfig] = useState<Config>({
        plan_name: '',
        price: 0,
        duration_days: 30,
        description: '',
        bank_name: '',
        bank_account_number: '',
        bank_account_holder: '',
        features: [],
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [newFeature, setNewFeature] = useState('')

    useEffect(() => {
        async function fetchConfig() {
            try {
                const res = await fetch('/api/admin/settings')
                const result = await res.json()
                if (result.success && result.data) {
                    setConfig({
                        plan_name: result.data.plan_name || '',
                        price: result.data.price || 0,
                        duration_days: result.data.duration_days || 30,
                        description: result.data.description || '',
                        bank_name: result.data.bank_name || '',
                        bank_account_number: result.data.bank_account_number || '',
                        bank_account_holder: result.data.bank_account_holder || '',
                        features: result.data.features || [],
                    })
                }
            } catch (error) {
                console.error('Error:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchConfig()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            })

            if (!res.ok) throw new Error('Failed to save')
            toast.success('Settings berhasil disimpan!')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSaving(false)
        }
    }

    const addFeature = () => {
        const text = newFeature.trim()
        if (!text) return
        setConfig({ ...config, features: [...config.features, text] })
        setNewFeature('')
    }

    const removeFeature = (index: number) => {
        setConfig({ ...config, features: config.features.filter((_, i) => i !== index) })
    }

    const updateFeature = (index: number, value: string) => {
        const updated = [...config.features]
        updated[index] = value
        setConfig({ ...config, features: updated })
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Subscription Settings</h2>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                >
                    {showPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {showPreview ? 'Sembunyikan Preview' : 'Lihat Preview'}
                </Button>
            </div>

            {/* Preview */}
            {showPreview && (
                <Card className="shadow-sm border-2 border-dashed border-primary/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Preview Halaman Subscribe
                        </CardTitle>
                        <CardDescription>Ini adalah tampilan yang akan dilihat user</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Left - Plan Info Preview */}
                            <div className="rounded-xl overflow-hidden border-2 shadow-sm">
                                <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-6 text-center">
                                    <h3 className="text-xl font-bold mb-1">{config.plan_name || 'Akses Penuh'}</h3>
                                    <div className="text-4xl font-bold tracking-tight">
                                        {formatCurrency(config.price || 0)}
                                    </div>
                                    <p className="text-white/70 text-sm mt-1">
                                        / {config.duration_days || 30} hari
                                    </p>
                                </div>
                                <div className="p-5 bg-white">
                                    <p className="text-sm text-muted-foreground mb-4">
                                        {config.description || 'Akses semua fitur Invoice Generator tanpa batas.'}
                                    </p>
                                    <div className="space-y-2.5">
                                        {(config.features.length > 0 ? config.features : ['Generate invoice PDF tanpa batas', 'Upload Excel & auto-generate', 'Akses history & edit invoice', 'Download PDF, ZIP, & merge']).map((feature, i) => (
                                            <div key={i} className="flex items-center gap-2.5">
                                                <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                                </div>
                                                <span className="text-sm">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right - Payment Upload Preview */}
                            <div className="rounded-xl border shadow-sm bg-white">
                                <div className="p-5">
                                    <h3 className="font-semibold text-base mb-1">Upload Bukti Pembayaran</h3>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        Transfer lalu upload bukti:
                                    </p>
                                    <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm mb-3">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Bank</span>
                                            <span className="font-medium">{config.bank_name || 'BCA'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">No. Rekening</span>
                                            <span className="font-mono font-medium">{config.bank_account_number || '1234567890'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Atas Nama</span>
                                            <span className="font-medium">{config.bank_account_holder || 'PT Invoice Generator'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Nominal</span>
                                            <span className="font-bold">{formatCurrency(config.price || 0)}</span>
                                        </div>
                                    </div>
                                    <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-6 text-muted-foreground">
                                        <Upload className="h-6 w-6 mb-1" />
                                        <p className="text-sm font-medium">Upload bukti transfer</p>
                                        <p className="text-xs">JPG, PNG, PDF (maks 5MB)</p>
                                    </div>
                                    <div className="mt-3 w-full bg-primary text-primary-foreground rounded-md py-2 text-center text-sm font-medium">
                                        <Upload className="h-4 w-4 inline mr-2" />
                                        Kirim Bukti Pembayaran
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Plan Config */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Konfigurasi Plan</CardTitle>
                        <CardDescription>
                            Atur nama, harga, dan durasi subscription
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Nama Plan</label>
                            <Input
                                value={config.plan_name}
                                onChange={(e) => setConfig({ ...config, plan_name: e.target.value })}
                                placeholder="Akses Penuh"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Harga (IDR)</label>
                            <Input
                                type="number"
                                value={config.price}
                                onChange={(e) => setConfig({ ...config, price: parseFloat(e.target.value) || 0 })}
                                placeholder="50000"
                                className="mt-1"
                                step="1000"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Durasi (hari)</label>
                            <Input
                                type="number"
                                value={config.duration_days}
                                onChange={(e) => setConfig({ ...config, duration_days: parseInt(e.target.value) || 30 })}
                                placeholder="30"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Deskripsi</label>
                            <Input
                                value={config.description}
                                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                                placeholder="Deskripsi plan..."
                                className="mt-1"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Bank Info */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Informasi Bank</CardTitle>
                        <CardDescription>
                            Detail rekening untuk pembayaran user
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Nama Bank</label>
                            <Input
                                value={config.bank_name}
                                onChange={(e) => setConfig({ ...config, bank_name: e.target.value })}
                                placeholder="BCA"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">No. Rekening</label>
                            <Input
                                value={config.bank_account_number}
                                onChange={(e) => setConfig({ ...config, bank_account_number: e.target.value })}
                                placeholder="1234567890"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Atas Nama</label>
                            <Input
                                value={config.bank_account_holder}
                                onChange={(e) => setConfig({ ...config, bank_account_holder: e.target.value })}
                                placeholder="PT Invoice Generator"
                                className="mt-1"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Features */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Fitur-fitur Plan</CardTitle>
                    <CardDescription>
                        Daftar fitur yang ditampilkan di halaman subscribe
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {config.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <Check className="h-3.5 w-3.5 text-green-600" />
                            </div>
                            <Input
                                value={feature}
                                onChange={(e) => updateFeature(index, e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFeature(index)}
                                className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 shrink-0" />
                        <Input
                            value={newFeature}
                            onChange={(e) => setNewFeature(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                            placeholder="Tambah fitur baru..."
                            className="flex-1"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={addFeature}
                            disabled={!newFeature.trim()}
                            className="shrink-0"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving} className="w-full max-w-xs">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Menyimpan...' : 'Simpan Semua Settings'}
            </Button>
        </div>
    )
}
