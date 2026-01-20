'use client'

import { ParsedExcelData, InvoiceItemForm } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getSupplierConfig } from '@/data/cv-reference'
import { getParsedDataSummary } from '@/lib/excel-parser'
import { Package, CreditCard, FileText, Building2 } from 'lucide-react'

interface InvoicePreviewProps {
    data: ParsedExcelData
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount)
}

function SupplierTab({ supplier, items }: { supplier: string; items: InvoiceItemForm[] }) {
    const config = getSupplierConfig(supplier)
    const total = items.reduce((sum, item) => sum + item.total, 0)
    const themeColor = config?.themeColor || '#6B7280'

    return (
        <div className="space-y-4">
            {/* Summary Cards with Theme Color */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4" style={{ borderLeftColor: themeColor }}>
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${themeColor}20` }}
                            >
                                <Package className="h-5 w-5" style={{ color: themeColor }} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{items.length}</div>
                                <p className="text-xs text-muted-foreground">Total Item</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4" style={{ borderLeftColor: themeColor }}>
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${themeColor}20` }}
                            >
                                <CreditCard className="h-5 w-5" style={{ color: themeColor }} />
                            </div>
                            <div>
                                <div className="text-xl font-bold">{formatCurrency(total)}</div>
                                <p className="text-xs text-muted-foreground">Subtotal</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4" style={{ borderLeftColor: themeColor }}>
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${themeColor}20` }}
                            >
                                <Building2 className="h-5 w-5" style={{ color: themeColor }} />
                            </div>
                            <div>
                                <div className="text-sm font-semibold">{config?.bankName || 'BNI'}</div>
                                <p className="text-xs text-muted-foreground font-mono">
                                    {config?.bankAccount || '-'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Items Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4" style={{ color: themeColor }} />
                        Daftar Item
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto max-h-[350px] border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-12">No</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Harga</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                        <TableCell className="font-medium">{item.item_name}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {formatCurrency(item.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export function InvoicePreview({ data }: InvoicePreviewProps) {
    const summary = getParsedDataSummary(data)
    const suppliers = Object.keys(data)

    if (suppliers.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    Tidak ada data untuk ditampilkan
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Overall Summary */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Ringkasan Data
                    </CardTitle>
                    <CardDescription>Total dari semua supplier yang akan di-generate</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold">{suppliers.length}</div>
                            <p className="text-sm text-muted-foreground">Supplier</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold">{summary.totalItems}</div>
                            <p className="text-sm text-muted-foreground">Total Item</p>
                        </div>
                        <div className="bg-primary/10 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-primary">{formatCurrency(summary.grandTotal)}</div>
                            <p className="text-sm text-muted-foreground">Grand Total</p>
                        </div>
                    </div>

                    {/* CV Breakdown Cards */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Detail per CV:</p>
                        <div className="grid gap-3">
                            {summary.suppliers.map((s) => {
                                const config = getSupplierConfig(s.supplier)
                                const themeColor = config?.themeColor || '#6B7280'
                                const itemCount = data[s.supplier]?.length || 0
                                return (
                                    <div
                                        key={s.supplier}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                        style={{ borderLeftWidth: '4px', borderLeftColor: themeColor }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: themeColor }}
                                            />
                                            <div>
                                                <div className="font-semibold text-sm">{s.supplier}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {itemCount} item · {config?.category || 'Lainnya'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold" style={{ color: themeColor }}>
                                                {formatCurrency(s.subtotal)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs per Supplier */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Detail per Supplier</CardTitle>
                    <CardDescription>Pilih tab untuk melihat detail item tiap supplier</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue={suppliers[0]} className="w-full">
                        <TabsList className="grid w-full mb-4" style={{ gridTemplateColumns: `repeat(${suppliers.length}, 1fr)` }}>
                            {suppliers.map((supplier) => {
                                const config = getSupplierConfig(supplier)
                                const themeColor = config?.themeColor || '#6B7280'
                                return (
                                    <TabsTrigger
                                        key={supplier}
                                        value={supplier}
                                        className="text-xs md:text-sm data-[state=active]:shadow-sm"
                                        style={{
                                            '--tab-active-color': themeColor,
                                        } as React.CSSProperties}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full mr-2 hidden md:inline-block"
                                            style={{ backgroundColor: themeColor }}
                                        />
                                        {supplier.replace('CV ', '').replace('UMKM ', '')}
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>
                        {suppliers.map((supplier) => (
                            <TabsContent key={supplier} value={supplier} className="mt-0">
                                <SupplierTab supplier={supplier} items={data[supplier] || []} />
                            </TabsContent>
                        ))}
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
