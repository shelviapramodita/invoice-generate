'use client'

import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Eye, Trash2, Calendar, Package, X } from 'lucide-react'
import { toast } from 'sonner'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { InvoiceDetailView } from './invoice-detail-view'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
import { exportHistoryToExcel } from '@/lib/excel/excel-export'

interface InvoiceHistory {
    id: string
    batch_name: string | null
    invoice_date: string
    total_suppliers: number
    total_items: number
    grand_total: number
    status: 'generated' | 'completed'
    created_at: string
}

interface HistoryTableProps {
    data: InvoiceHistory[]
    onRefresh?: () => void
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount)
}

function getStatusColor(status: string): 'default' | 'secondary' {
    switch (status) {
        case 'completed':
            return 'default'
        case 'generated':
            return 'secondary'
        default:
            return 'secondary'
    }
}

export function HistoryTable({ data, onRefresh }: HistoryTableProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showDetailView, setShowDetailView] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null)

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
    const [bulkDeleting, setBulkDeleting] = useState(false)

    // Ref for indeterminate checkbox
    const selectAllRef = useRef<HTMLButtonElement>(null)

    const handleView = (id: string) => {
        setSelectedId(id)
        setShowDetailView(true)
    }

    const handleDeleteClick = (id: string) => {
        setInvoiceToDelete(id)
        setShowDeleteConfirm(true)
    }

    const handleDelete = async () => {
        if (!invoiceToDelete) return

        const id = invoiceToDelete
        setDeleting(id)

        try {
            const response = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
            const responseData = await response.json()

            if (!response.ok) {
                throw new Error(responseData.message || 'Failed to delete')
            }

            toast.success('Invoice berhasil dihapus!')
            onRefresh?.()
        } catch (error) {
            toast.error(`Gagal menghapus invoice: ${(error as Error).message}`)
        } finally {
            setDeleting(null)
            setInvoiceToDelete(null)
        }
    }

    const handleDetailDelete = () => {
        onRefresh?.()
    }

    // Computed selection state
    const isAllSelected = data.length > 0 && selectedIds.size === data.length
    const isSomeSelected = selectedIds.size > 0 && selectedIds.size < data.length
    const hasSelection = selectedIds.size > 0

    // Indeterminate state for select-all checkbox
    useEffect(() => {
        if (selectAllRef.current) {
            const input = selectAllRef.current.querySelector('input[type="checkbox"]') as HTMLInputElement | null
            if (input) {
                input.indeterminate = isSomeSelected
            }
        }
    }, [isSomeSelected])

    // Multi-select handlers
    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (checked === true) {
            setSelectedIds(new Set(data.map(inv => inv.id)))
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        const next = new Set(selectedIds)
        if (checked) next.add(id)
        else next.delete(id)
        setSelectedIds(next)
    }

    const handleBulkDeleteClick = () => setShowBulkDeleteConfirm(true)

    const handleBulkDelete = async () => {
        setBulkDeleting(true)
        const idsToDelete = Array.from(selectedIds)

        try {
            const response = await fetch('/api/invoices/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToDelete }),
            })

            const resData = await response.json()

            if (!response.ok) {
                throw new Error(resData.message || 'Failed to delete invoices')
            }

            toast.success(`${resData.deletedCount} invoice berhasil dihapus`)
            setSelectedIds(new Set())
            onRefresh?.()
        } catch (error) {
            toast.error(`Gagal menghapus invoice: ${(error as Error).message}`)
        } finally {
            setBulkDeleting(false)
            setShowBulkDeleteConfirm(false)
        }
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Belum ada invoice</h3>
                <p className="text-muted-foreground">
                    Upload file Excel untuk membuat invoice pertama Anda
                </p>
            </div>
        )
    }

    return (
        <>
            <div className="rounded-md border overflow-hidden">
                {/* Bulk Action Toolbar — muncul di dalam tabel header */}
                {hasSelection ? (
                    <div className="flex items-center justify-between border-b bg-muted/60 px-4 py-2.5 transition-all">
                        <div className="flex items-center gap-3">
                            {/* Checkbox kiri sudah ada di kolom, tampilkan info */}
                            <span className="text-sm font-medium text-foreground">
                                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 rounded bg-foreground text-background text-xs font-semibold px-1.5 mr-2">
                                    {selectedIds.size}
                                </span>
                                invoice dipilih
                            </span>
                            <span className="text-border">|</span>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3 w-3" />
                                Batalkan
                            </button>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDeleteClick}
                            disabled={bulkDeleting}
                            className="h-7 gap-1.5 text-xs px-3"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus {selectedIds.size} Invoice
                        </Button>
                    </div>
                ) : null}

                <Table>
                    <TableHeader>
                        <TableRow className={hasSelection ? '' : ''}>
                            <TableHead className="w-11 pl-4">
                                <Checkbox
                                    ref={selectAllRef as any}
                                    checked={isAllSelected}
                                    onCheckedChange={handleSelectAll}
                                    aria-label="Pilih semua invoice"
                                    title={isAllSelected || isSomeSelected ? 'Batalkan semua' : 'Pilih semua'}
                                />
                            </TableHead>
                            <TableHead>Batch Name</TableHead>
                            <TableHead>Tanggal Invoice</TableHead>
                            <TableHead className="text-center">Suppliers</TableHead>
                            <TableHead className="text-center">Items</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right pr-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((invoice) => {
                            const isSelected = selectedIds.has(invoice.id)
                            return (
                                <TableRow
                                    key={invoice.id}
                                    className={
                                        isSelected
                                            ? 'bg-muted/40 hover:bg-muted/60'
                                            : 'hover:bg-muted/30'
                                    }
                                    onClick={() => handleSelectOne(invoice.id, !isSelected)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked) =>
                                                handleSelectOne(invoice.id, checked as boolean)
                                            }
                                            aria-label={`Pilih ${invoice.batch_name || 'invoice'}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {invoice.batch_name || 'Untitled'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-3.5 w-3.5" />
                                            <span className="text-foreground">
                                                {format(new Date(invoice.invoice_date), 'dd MMM yyyy', {
                                                    locale: id,
                                                })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline">{invoice.total_suppliers}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {invoice.total_items}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {formatCurrency(invoice.grand_total)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={getStatusColor(invoice.status)}>
                                            {invoice.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell
                                        className="text-right pr-4"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => handleView(invoice.id)}
                                                title="Lihat Detail"
                                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => handleDeleteClick(invoice.id)}
                                                disabled={deleting === invoice.id}
                                                title="Hapus Invoice"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Detail View */}
            <InvoiceDetailView
                invoiceId={selectedId}
                open={showDetailView}
                onOpenChange={setShowDetailView}
                onDelete={handleDetailDelete}
            />

            {/* Delete Single Confirmation */}
            <DeleteConfirmationDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleDelete}
                loading={deleting !== null}
            />

            {/* Bulk Delete Confirmation */}
            <DeleteConfirmationDialog
                open={showBulkDeleteConfirm}
                onOpenChange={setShowBulkDeleteConfirm}
                onConfirm={handleBulkDelete}
                loading={bulkDeleting}
                title="Hapus Invoice Terpilih"
                description={`Apakah Anda yakin ingin menghapus ${selectedIds.size} invoice? Tindakan ini tidak dapat dibatalkan.`}
            />
        </>
    )
}
