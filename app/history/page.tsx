'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HistoryTable } from '@/components/history/history-table'
import { HistoryFilters, FilterState } from '@/components/history/history-filters'
import { createClient } from '@/lib/supabase/client'

interface InvoiceHistory {
    id: string
    batch_name: string | null
    invoice_date: string
    total_suppliers: number
    total_items: number
    grand_total: number
    status: 'generated' | 'completed'
    created_at: string
    suppliers?: string[]
}

export default function HistoryPage() {
    const [history, setHistory] = useState<InvoiceHistory[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filters, setFilters] = useState<FilterState>({
        search: '',
        supplier: 'all',
        status: 'all',
        dateFrom: null,
        dateTo: null,
    })

    const fetchHistory = async () => {
        setLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const { data, error: fetchError } = await supabase
                .from('invoice_history')
                .select('*, invoice_items(supplier)')
                .order('created_at', { ascending: false })
                .limit(50)

            if (fetchError) {
                throw new Error(fetchError.message)
            }

            // Transform data to include suppliers array for easier filtering
            const historyWithSuppliers = (data as any[]).map(item => ({
                ...item,
                suppliers: Array.from(new Set(item.invoice_items?.map((i: any) => i.supplier) || []))
            }))

            setHistory(historyWithSuppliers as InvoiceHistory[])
        } catch (err: unknown) {
            console.error('Error fetching history:', err)
            setError(err instanceof Error ? err.message : 'Gagal memuat history')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchHistory()
    }, [])

    // Client-side filtering
    const filteredHistory = useMemo(() => {
        let filtered = [...history]

        // Search filter (batch name or invoice number)
        if (filters.search) {
            const searchLower = filters.search.toLowerCase()
            filtered = filtered.filter(
                (inv) =>
                    inv.batch_name?.toLowerCase().includes(searchLower) ||
                    inv.id.toLowerCase().includes(searchLower)
            )
        }

        // Supplier filter
        if (filters.supplier !== 'all') {
            filtered = filtered.filter((inv) =>
                inv.suppliers?.includes(filters.supplier)
            )
        }

        // Status filter
        if (filters.status !== 'all') {
            filtered = filtered.filter((inv) => inv.status === filters.status)
        }

        // Date range filter - normalize to date only (ignore time)
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom)
            fromDate.setHours(0, 0, 0, 0)

            filtered = filtered.filter((inv) => {
                const invDate = new Date(inv.invoice_date)
                invDate.setHours(0, 0, 0, 0)
                return invDate >= fromDate
            })
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo)
            toDate.setHours(23, 59, 59, 999)

            filtered = filtered.filter((inv) => {
                const invDate = new Date(inv.invoice_date)
                invDate.setHours(0, 0, 0, 0)
                return invDate <= toDate
            })
        }

        return filtered
    }, [history, filters])

    // Get unique suppliers for filter dropdown
    const uniqueSuppliers = useMemo(() => {
        return ['CV JAYAMEN', 'UMKM UNDI YUWONO', 'CV SEKAR WIJAYAKUSUMA']
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <Link href="/">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Kembali
                            </Button>
                        </Link>
                    </div>
                    <Button onClick={fetchHistory} disabled={loading} variant="outline">
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">
                            History Invoice
                        </h1>
                        <p className="text-muted-foreground">
                            Daftar semua invoice yang pernah dibuat
                        </p>
                    </div>

                    {/* Filters */}
                    <HistoryFilters
                        filters={filters}
                        onFiltersChange={setFilters}
                        suppliers={uniqueSuppliers}
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle>Daftar Invoice</CardTitle>
                            <CardDescription>
                                Menampilkan {filteredHistory.length} dari {history.length} invoice
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading && (
                                <div className="text-center py-12">
                                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4" />
                                    <p className="text-muted-foreground">Memuat data...</p>
                                </div>
                            )}

                            {error && (
                                <div className="text-center py-12">
                                    <p className="text-destructive mb-4">{error}</p>
                                    <Button onClick={fetchHistory} variant="outline">
                                        Coba Lagi
                                    </Button>
                                </div>
                            )}

                            {!loading && !error && (
                                <HistoryTable data={filteredHistory} onRefresh={fetchHistory} />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
