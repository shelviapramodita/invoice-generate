'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Monitor, Globe, Clock } from 'lucide-react'

interface LoginRecord {
    id: string
    user_id: string
    device_info: string
    ip_address: string
    logged_in_at: string
    profiles: {
        name: string | null
        email: string
    }
}

export default function LoginHistoryPage() {
    const [history, setHistory] = useState<LoginRecord[]>([])
    const [loading, setLoading] = useState(true)

    const fetchHistory = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/login-history')
            const data = await res.json()
            if (data.success) {
                setHistory(data.data)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchHistory()
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Login History</h2>
                    <p className="text-muted-foreground">Riwayat login semua user (100 terbaru)</p>
                </div>
                <Button onClick={fetchHistory} disabled={loading} variant="outline" size="sm">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Riwayat Login</CardTitle>
                    <CardDescription>
                        Menampilkan {history.length} catatan login
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading && history.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4" />
                            <p className="text-muted-foreground">Memuat data...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Belum ada riwayat login
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">User</th>
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Perangkat</th>
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">IP Address</th>
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Waktu</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((record) => (
                                        <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30">
                                            <td className="py-3 px-2">
                                                <div>
                                                    <p className="font-medium">{record.profiles.name || '-'}</p>
                                                    <p className="text-xs text-muted-foreground">{record.profiles.email}</p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-2">
                                                    <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    <span>{record.device_info || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    <span className="font-mono text-xs">{record.ip_address || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    <span>{new Date(record.logged_in_at).toLocaleDateString('id-ID', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
