'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Eye, Trash2, Calendar, Package, FileSpreadsheet } from 'lucide-react'
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

    const handleView = (id: string) => {
        setSelectedId(id)
        setShowDetailView(true)
    }

    const handleDeleteClick = (id: string) => {
        console.log('Delete clicked for invoice:', id)
        setInvoiceToDelete(id)
        setShowDeleteConfirm(true)
    }

    const handleDelete = async () => {
        if (!invoiceToDelete) return

        const id = invoiceToDelete
        setDeleting(id)
        console.log('Starting delete process for:', id)

        try {
            console.log('Calling DELETE /api/invoices/' + id)
            const response = await fetch(`/api/invoices/${id}`, {
                method: 'DELETE',
            })

            console.log('Response status:', response.status)

            const responseData = await response.json()
            console.log('Response data:', responseData)

            if (!response.ok) {
                throw new Error(responseData.message || 'Failed to delete')
            }

            alert('✅ Invoice berhasil dihapus!')
            console.log('Delete successful, refreshing...')
            onRefresh?.()
        } catch (error) {
            console.error('Error deleting:', error)
            alert(`❌ Gagal menghapus invoice\n\nError: ${(error as Error).message}`)
        } finally {
            setDeleting(null)
            setInvoiceToDelete(null)
            console.log('Delete process finished')
        }
    }

    const handleDetailDelete = () => {
        // This will be called after successful delete from detail view
        // Just refresh the data, modal already closed by detail view
        console.log('Detail delete callback - refreshing data')
        onRefresh?.()
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
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Batch Name</TableHead>
                            <TableHead>Tanggal Invoice</TableHead>
                            <TableHead className="text-center">Suppliers</TableHead>
                            <TableHead className="text-center">Items</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell className="font-medium">
                                    {invoice.batch_name || 'Untitled'}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        {format(new Date(invoice.invoice_date), 'dd MMM yyyy', {
                                            locale: id,
                                        })}
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
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleView(invoice.id)}
                                            title="View Details"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleDeleteClick(invoice.id)}
                                            disabled={deleting === invoice.id}
                                            title="Delete Invoice"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
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

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleDelete}
                loading={deleting !== null}
            />
        </>
    )
}
