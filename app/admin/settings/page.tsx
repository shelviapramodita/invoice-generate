'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

interface Config {
    plan_name: string
    price: number
    duration_days: number
    description: string
}

export default function AdminSettingsPage() {
    const [config, setConfig] = useState<Config>({
        plan_name: '',
        price: 0,
        duration_days: 30,
        description: '',
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

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

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Subscription Settings</h2>

            <Card className="shadow-sm max-w-xl">
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
                    <Button onClick={handleSave} disabled={saving} className="w-full">
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Menyimpan...' : 'Simpan Settings'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
