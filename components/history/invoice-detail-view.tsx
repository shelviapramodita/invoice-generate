'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Trash2, Eye, X, Edit, Save, CheckCircle, Plus, CalendarIcon, Download, FileDown, FileArchive, Files } from 'lucide-react'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FullScreenPDFPreview } from '@/components/invoice/fullscreen-pdf-preview'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { downloadFile } from '@/lib/storage/file-upload'

interface InvoiceItem {
    id: string
    supplier: string
    invoice_number: string
    item_name: string
    quantity: number
    unit: string
    price: number
    total: number
    pdf_file_path: string
}

interface InvoiceDetail {
    id: string
    batch_name: string | null
    invoice_date: string
    total_suppliers: number
    total_items: number
    grand_total: number
    status: string
    created_at: string
    items: InvoiceItem[]
}

interface InvoiceDetailViewProps {
    invoiceId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onDelete?: () => void
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount)
}

// Generate a temporary ID for new items (will be replaced by DB id)
let tempIdCounter = 0
function generateTempId() {
    tempIdCounter++
    return `__new_${tempIdCounter}_${Date.now()}`
}

export function InvoiceDetailView({
    invoiceId,
    open,
    onOpenChange,
    onDelete,
}: InvoiceDetailViewProps) {
    const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [downloading, setDownloading] = useState(false)
    const [loadingStatus, setLoadingStatus] = useState<string>('')
    const [showPreview, setShowPreview] = useState(false)
    const [previewPDFs, setPreviewPDFs] = useState<any[]>([])
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [markingComplete, setMarkingComplete] = useState(false)
    const [showDownloadOptions, setShowDownloadOptions] = useState(false)

    // Edit state
    const [editedItems, setEditedItems] = useState<InvoiceItem[]>([])
    const [editedBatchName, setEditedBatchName] = useState('')
    const [editedInvoiceDate, setEditedInvoiceDate] = useState('')
    const [deletedItemIds, setDeletedItemIds] = useState<string[]>([])
    const [activeSupplierTab, setActiveSupplierTab] = useState<string>('')

    // Dialog for adding new supplier
    const [showAddSupplier, setShowAddSupplier] = useState(false)
    const [newSupplierName, setNewSupplierName] = useState('')
    const [newSupplierInvoiceNumber, setNewSupplierInvoiceNumber] = useState('')

    const fetchDetail = useCallback(async () => {
        if (!invoiceId) return

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/invoices/${invoiceId}`)
            if (!response.ok) {
                throw new Error('Failed to fetch invoice detail')
            }

            const result = await response.json()
            setInvoice(result.data)
        } catch (err: any) {
            console.error('Error fetching detail:', err)
            setError(err.message || 'Unknown error')
        } finally {
            setLoading(false)
        }
    }, [invoiceId])

    useEffect(() => {
        if (open && invoiceId) {
            fetchDetail()
        }
    }, [open, invoiceId, fetchDetail])

    // Reset edit state when closing
    useEffect(() => {
        if (!open) {
            setIsEditing(false)
            setEditedItems([])
            setDeletedItemIds([])
        }
    }, [open])

    const handleDownloadPDF = async (supplier: string, pdfPath: string) => {
        if (!pdfPath) {
            toast.error('File PDF tidak ditemukan')
            return
        }

        try {
            document.body.style.cursor = 'wait'
            const blob = await downloadFile('generated-pdfs', pdfPath)
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `Invoice-${supplier}-${new Date().getTime()}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error downloading PDF:', error)
            toast.error('Gagal mendownload PDF. Pastikan file ada di storage.')
        } finally {
            document.body.style.cursor = 'default'
        }
    }

    const handleDelete = () => {
        setShowDeleteConfirm(true)
    }

    const handleConfirmDelete = async () => {
        if (!invoiceId) return

        setDeleting(true)
        setShowDeleteConfirm(false)

        try {
            const response = await fetch(`/api/invoices/${invoiceId}`, {
                method: 'DELETE',
            })

            const responseData = await response.json()

            if (!response.ok) {
                throw new Error(responseData.message || 'Failed to delete')
            }

            toast.success('Invoice berhasil dihapus!')
            onOpenChange(false)
            onDelete?.()
        } catch (error) {
            console.error('Error deleting:', error)
            toast.error(`Gagal menghapus invoice: ${(error as Error).message}`)
        } finally {
            setDeleting(false)
        }
    }


    const handleEdit = () => {
        if (invoice) {
            setEditedItems(invoice.items.map(item => ({ ...item })))
            setEditedBatchName(invoice.batch_name || '')
            setEditedInvoiceDate(invoice.invoice_date.split('T')[0])
            setDeletedItemIds([])
            setShowDownloadOptions(false)
            setIsEditing(true)
        }
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditedItems([])
        setDeletedItemIds([])
    }

    const handleItemChange = (itemId: string, field: keyof InvoiceItem, value: any) => {
        setEditedItems(prev => prev.map(item => {
            if (item.id !== itemId) return item

            const updated = { ...item, [field]: value }

            // Recalculate total if qty or price changed
            if (field === 'quantity' || field === 'price') {
                const qty = field === 'quantity' ? parseFloat(value) || 0 : updated.quantity
                const price = field === 'price' ? parseFloat(value) || 0 : updated.price
                updated.total = qty * price
            }

            return updated
        }))
    }

    // Change supplier name for all items of that supplier
    const handleSupplierNameChange = (oldName: string, newName: string) => {
        setEditedItems(prev => prev.map(item =>
            item.supplier === oldName ? { ...item, supplier: newName } : item
        ))
    }

    // Change invoice number for all items of that supplier
    const handleInvoiceNumberChange = (supplier: string, newNumber: string) => {
        setEditedItems(prev => prev.map(item =>
            item.supplier === supplier ? { ...item, invoice_number: newNumber } : item
        ))
    }

    // Delete single item
    const handleDeleteItem = (itemId: string) => {
        // Track DB items for server-side deletion
        if (!itemId.startsWith('__new_')) {
            setDeletedItemIds(prev => [...prev, itemId])
        }
        setEditedItems(prev => prev.filter(item => item.id !== itemId))
    }

    // Delete all items for a supplier
    const handleDeleteSupplier = (supplier: string) => {
        const supplierItems = editedItems.filter(item => item.supplier === supplier)
        const dbItemIds = supplierItems
            .filter(item => !item.id.startsWith('__new_'))
            .map(item => item.id)

        setDeletedItemIds(prev => [...prev, ...dbItemIds])
        setEditedItems(prev => prev.filter(item => item.supplier !== supplier))
    }

    // Add item to a supplier
    const handleAddItem = (supplier: string) => {
        const supplierItems = editedItems.filter(i => i.supplier === supplier)
        const invoiceNumber = supplierItems[0]?.invoice_number || '#KWITANSI0001'

        const newItem: InvoiceItem = {
            id: generateTempId(),
            supplier,
            invoice_number: invoiceNumber,
            item_name: '',
            quantity: 0,
            unit: 'pcs',
            price: 0,
            total: 0,
            pdf_file_path: '',
        }

        setEditedItems(prev => [...prev, newItem])
    }

    // Add new supplier
    const handleAddSupplier = () => {
        if (!newSupplierName.trim()) {
            toast.error('Nama supplier tidak boleh kosong')
            return
        }

        // Check duplicate
        const existing = editedItems.find(
            i => i.supplier.toLowerCase() === newSupplierName.trim().toLowerCase()
        )
        if (existing) {
            toast.error('Supplier sudah ada')
            return
        }

        const newItem: InvoiceItem = {
            id: generateTempId(),
            supplier: newSupplierName.trim(),
            invoice_number: newSupplierInvoiceNumber.trim() || '#KWITANSI0001',
            item_name: '',
            quantity: 0,
            unit: 'pcs',
            price: 0,
            total: 0,
            pdf_file_path: '',
        }

        setEditedItems(prev => [...prev, newItem])
        setActiveSupplierTab(newSupplierName.trim())
        setShowAddSupplier(false)
        setNewSupplierName('')
        setNewSupplierInvoiceNumber('')
    }

    const handleSaveEdit = async (andDownload = false) => {
        if (!invoiceId) return

        // Validate: at least 1 item with item_name
        const validItems = editedItems.filter(i => i.item_name.trim())
        if (validItems.length === 0) {
            toast.error('Minimal harus ada 1 item dengan nama barang')
            return
        }

        setSaving(true)
        try {
            // Separate existing items (update) vs new items (insert)
            const existingItems = validItems.filter(i => !i.id.startsWith('__new_'))
            const newItems = validItems.filter(i => i.id.startsWith('__new_'))

            const payload: any = {}

            // Metadata
            if (editedBatchName !== (invoice?.batch_name || '')) {
                payload.batch_name = editedBatchName || null
            }
            if (editedInvoiceDate !== invoice?.invoice_date.split('T')[0]) {
                payload.invoice_date = editedInvoiceDate
            }

            // Existing items to update
            if (existingItems.length > 0) {
                payload.items = existingItems
            }

            // New items to insert
            if (newItems.length > 0) {
                payload.new_items = newItems.map(item => ({
                    supplier: item.supplier,
                    invoice_number: item.invoice_number,
                    item_name: item.item_name,
                    quantity: item.quantity,
                    unit: item.unit,
                    price: item.price,
                    total: item.total,
                }))
            }

            // Items to delete
            if (deletedItemIds.length > 0) {
                payload.delete_item_ids = deletedItemIds
            }

            const response = await fetch(`/api/invoices/${invoiceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.message || 'Failed to save changes')
            }

            setIsEditing(false)
            setDeletedItemIds([])
            await fetchDetail()
            onDelete?.() // Refresh parent list

            if (andDownload) {
                toast.success('Perubahan disimpan! Pilih opsi download.')
                setShowDownloadOptions(true)
            } else {
                toast.success('Perubahan berhasil disimpan dan PDF sudah di-regenerate!')
            }
        } catch (error) {
            console.error('Error saving:', error)
            toast.error(`Gagal menyimpan perubahan: ${(error as Error).message}`)
        } finally {
            setSaving(false)
        }
    }

    // Fetch all generated PDFs from storage
    const fetchGeneratedPDFs = async () => {
        const response = await fetch(`/api/invoices/${invoiceId}`)
        if (!response.ok) throw new Error('Failed to fetch updated invoice')
        const result = await response.json()
        const latestInvoice = result.data as InvoiceDetail

        const supplierPdfMap: Record<string, { supplier: string; invoiceNumber: string; pdfPath: string }> = {}
        for (const item of latestInvoice.items) {
            if (!supplierPdfMap[item.supplier] && item.pdf_file_path && item.pdf_file_path !== 'client-side-download' && item.pdf_file_path !== 'pending-regeneration') {
                supplierPdfMap[item.supplier] = {
                    supplier: item.supplier,
                    invoiceNumber: item.invoice_number,
                    pdfPath: item.pdf_file_path,
                }
            }
        }

        const entries = Object.values(supplierPdfMap)
        if (entries.length === 0) throw new Error('Tidak ada PDF yang tersedia')

        const pdfs: { supplier: string; invoiceNumber: string; blob: Blob }[] = []
        for (const entry of entries) {
            const blob = await downloadFile('generated-pdfs', entry.pdfPath)
            pdfs.push({ supplier: entry.supplier, invoiceNumber: entry.invoiceNumber, blob })
        }

        return { pdfs, batchName: latestInvoice.batch_name }
    }

    // Download option: individual files
    const handleDownloadSeparate = async () => {
        setDownloading(true)
        setShowDownloadOptions(false)
        try {
            const { pdfs, batchName } = await fetchGeneratedPDFs()
            const { downloadPDF } = await import('@/lib/pdf/pdf-generator')
            const safeBatch = batchName?.replace(/[\/\\:*?"<>|]/g, '-')?.trim()

            for (const p of pdfs) {
                const filename = safeBatch
                    ? `${safeBatch}-${p.supplier}-${p.invoiceNumber}.pdf`
                    : `Invoice-${p.supplier}-${p.invoiceNumber}.pdf`
                downloadPDF(p.blob, filename)
            }
            toast.success(`${pdfs.length} PDF berhasil diunduh!`)
        } catch (error) {
            toast.error(`Gagal mengunduh: ${(error as Error).message}`)
        } finally {
            setDownloading(false)
        }
    }

    // Download option: merge into 1 PDF
    const handleDownloadMerged = async () => {
        setDownloading(true)
        setShowDownloadOptions(false)
        try {
            const { pdfs, batchName } = await fetchGeneratedPDFs()
            const { mergePDFs } = await import('@/lib/pdf/pdf-generator')
            const safeBatch = batchName?.replace(/[\/\\:*?"<>|]/g, '-')?.trim()
            const filename = safeBatch
                ? `${safeBatch}-Merged.pdf`
                : `Invoices-Merged-${Date.now()}.pdf`
            await mergePDFs(pdfs, filename)
            toast.success('PDF gabungan berhasil diunduh!')
        } catch (error) {
            toast.error(`Gagal menggabungkan PDF: ${(error as Error).message}`)
        } finally {
            setDownloading(false)
        }
    }

    // Download option: ZIP
    const handleDownloadZip = async () => {
        setDownloading(true)
        setShowDownloadOptions(false)
        try {
            const { pdfs, batchName } = await fetchGeneratedPDFs()
            const { downloadAsZip } = await import('@/lib/pdf/pdf-generator')
            const safeBatch = batchName?.replace(/[\/\\:*?"<>|]/g, '-')?.trim()
            const filename = safeBatch
                ? `Invoices-${safeBatch}.zip`
                : `Invoices-${Date.now()}.zip`
            await downloadAsZip(pdfs, filename)
            toast.success('ZIP berhasil diunduh!')
        } catch (error) {
            toast.error(`Gagal membuat ZIP: ${(error as Error).message}`)
        } finally {
            setDownloading(false)
        }
    }

    const handleMarkComplete = async () => {
        if (!invoiceId) return

        setMarkingComplete(true)
        try {
            const response = await fetch(`/api/invoices/${invoiceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.message || 'Failed to update status')
            }

            toast.success('Invoice berhasil ditandai selesai!')
            await fetchDetail()
            onDelete?.()
        } catch (error) {
            console.error('Error marking complete:', error)
            toast.error(`Gagal mengubah status: ${(error as Error).message}`)
        } finally {
            setMarkingComplete(false)
        }
    }

    if (!invoice && !loading) {
        return null
    }

    // Determine active items (view vs edit)
    const currentItems = isEditing ? editedItems : (invoice?.items || [])

    // Calculate totals dynamically
    const displayGrandTotal = currentItems.reduce((sum, item) => sum + item.total, 0)
    const displayTotalItems = currentItems.length

    // Group items by supplier
    const itemsBySupplier: Record<string, InvoiceItem[]> = {}
    currentItems.forEach((item) => {
        if (!itemsBySupplier[item.supplier]) {
            itemsBySupplier[item.supplier] = []
        }
        itemsBySupplier[item.supplier]!.push(item)
    })

    const suppliers = Object.keys(itemsBySupplier)

    // Fetch all PDFs for batch download
    const fetchAllPDFs = async (onProgress?: (count: number, total: number) => void) => {
        if (!invoice) return []

        let completed = 0
        const total = suppliers.length

        const pdfPromises = suppliers.map(async (supplier) => {
            const items = itemsBySupplier[supplier]
            const pdfPath = items[0]?.pdf_file_path

            if (!pdfPath || pdfPath === 'client-side-download') {
                completed++
                onProgress?.(completed, total)
                return null
            }

            try {
                const blob = await downloadFile('generated-pdfs', pdfPath)
                completed++
                onProgress?.(completed, total)
                return {
                    supplier,
                    invoiceNumber: items[0]?.invoice_number || '',
                    blob
                }
            } catch (error) {
                console.error(`Error downloading PDF for ${supplier}:`, error)
                completed++
                onProgress?.(completed, total)
                return null
            }
        })

        const pdfs = await Promise.all(pdfPromises)
        return pdfs.filter((pdf): pdf is { supplier: string; invoiceNumber: string; blob: Blob } => pdf !== null)
    }

    const handleDownloadAll = async () => {
        setDownloading(true)
        try {
            const pdfs = await fetchAllPDFs()
            if (pdfs.length === 0) {
                toast.warning('Tidak ada PDF yang tersedia untuk didownload')
                return
            }

            const { downloadAllPDFs } = await import('@/lib/pdf/pdf-generator')
            await downloadAllPDFs(pdfs, invoice?.batch_name || undefined)
        } catch (error) {
            console.error('Error downloading all PDFs:', error)
            toast.error('Gagal mendownload PDFs')
        } finally {
            setDownloading(false)
        }
    }

    const handlePreview = async () => {
        const hasStoredPDFs = suppliers.some(s => {
            const path = itemsBySupplier[s]?.[0]?.pdf_file_path
            return path && path !== 'client-side-download'
        })

        if (!hasStoredPDFs) {
            toast.warning('PDFs tidak tersedia untuk preview. Invoice ini di-generate dengan metode lama.')
            return
        }

        setDownloading(true)
        setLoadingStatus('Preparing...')
        setShowPreview(true)

        try {
            const pdfs = await fetchAllPDFs((c, t) => {
                setLoadingStatus(`Downloading ${c}/${t}...`)
            })

            if (pdfs.length > 0) {
                setLoadingStatus('Opening preview...')
                setPreviewPDFs(pdfs)
            } else {
                toast.warning('Tidak ada PDF yang tersedia di storage untuk invoice ini.')
                setShowPreview(false)
            }
        } catch (error) {
            console.error('Error fetching PDFs for preview:', error)
            toast.error(`Critical Error: ${(error as Error).message}`)
            setShowPreview(false)
        } finally {
            setDownloading(false)
            setLoadingStatus('')
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="sm:max-w-7xl h-[90vh] w-full p-0 flex flex-col gap-0 overflow-hidden"
                    showCloseButton={false}
                >
                    <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 mr-4">
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Batch Name</label>
                                            <Input
                                                value={editedBatchName}
                                                onChange={(e) => setEditedBatchName(e.target.value)}
                                                placeholder="Nama batch..."
                                                className="mt-1 h-9 text-base font-semibold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tanggal Invoice</label>
                                            <div className="relative mt-1">
                                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="date"
                                                    value={editedInvoiceDate}
                                                    onChange={(e) => setEditedInvoiceDate(e.target.value)}
                                                    className="h-9 pl-10"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <DialogTitle>Invoice Detail</DialogTitle>
                                        <DialogDescription>
                                            {invoice?.batch_name || 'Untitled'} -{' '}
                                            {invoice && format(new Date(invoice.invoice_date), 'dd MMMM yyyy', { locale: idLocale })}
                                        </DialogDescription>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {isEditing ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCancelEdit}
                                            disabled={saving}
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Batal
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => handleSaveEdit(false)}
                                            disabled={saving}
                                        >
                                            <Save className="h-4 w-4 mr-2" />
                                            {saving ? 'Menyimpan...' : 'Simpan'}
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => handleSaveEdit(true)}
                                            disabled={saving}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            {saving ? 'Menyimpan...' : 'Simpan & Download'}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleEdit}
                                        >
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => onOpenChange(false)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6">
                        {loading && (
                            <div className="flex items-center justify-center py-12">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            </div>
                        )}

                        {error && (
                            <div className="py-12 text-center">
                                <p className="text-destructive mb-4">{error}</p>
                                <Button onClick={fetchDetail} variant="outline">
                                    Coba Lagi
                                </Button>
                            </div>
                        )}

                        {invoice && !loading && (
                            <div className="mt-6 space-y-6 pb-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 gap-4">
                                    <Card className="bg-primary/5 border-primary/10 shadow-sm">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                Total Suppliers
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-3xl font-bold text-primary">{suppliers.length}</div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-primary/5 border-primary/10 shadow-sm">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                Total Items
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-3xl font-bold text-primary">{displayTotalItems}</div>
                                        </CardContent>
                                    </Card>

                                    <Card className="col-span-2 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground border-none shadow-md">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-medium text-primary-foreground/80 uppercase tracking-wider">
                                                Grand Total
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-4xl font-bold tracking-tight">
                                                {formatCurrency(displayGrandTotal)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Items per Supplier */}
                                {suppliers.length > 0 ? (
                                    <Tabs
                                        value={activeSupplierTab || suppliers[0]}
                                        onValueChange={setActiveSupplierTab}
                                        className="w-full"
                                    >
                                        <div className="flex items-center gap-2 mb-6">
                                            <TabsList className="flex-1 h-auto p-1 bg-muted/50 rounded-xl flex flex-wrap gap-1">
                                                {suppliers.map((supplier) => (
                                                    <TabsTrigger
                                                        key={supplier}
                                                        value={supplier}
                                                        className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm py-2 text-sm transition-all"
                                                    >
                                                        {supplier}
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>
                                            {isEditing && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setShowAddSupplier(true)}
                                                    className="shrink-0 gap-1.5"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Supplier
                                                </Button>
                                            )}
                                        </div>

                                        {suppliers.map((supplier) => {
                                            const items = itemsBySupplier[supplier] || []
                                            const subtotal = items.reduce((sum, item) => sum + item.total, 0)
                                            const invoiceNumber = items[0]?.invoice_number || ''

                                            return (
                                                <TabsContent key={supplier} value={supplier} className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                                                    <div className="flex items-center justify-between flex-wrap gap-3 bg-muted/30 p-4 rounded-xl border">
                                                        <div className="flex-1 min-w-0">
                                                            {isEditing ? (
                                                                <div className="space-y-2">
                                                                    <div>
                                                                        <label className="text-xs text-muted-foreground">Nama Supplier</label>
                                                                        <Input
                                                                            value={supplier}
                                                                            onChange={(e) => handleSupplierNameChange(supplier, e.target.value)}
                                                                            className="mt-0.5 h-8 font-bold text-base"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-muted-foreground">Nomor Invoice</label>
                                                                        <Input
                                                                            value={invoiceNumber}
                                                                            onChange={(e) => handleInvoiceNumberChange(supplier, e.target.value)}
                                                                            placeholder="#KWITANSI0001"
                                                                            className="mt-0.5 h-8 font-mono text-sm"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <h3 className="font-bold text-lg text-foreground">{supplier}</h3>
                                                                    <p className="text-sm text-muted-foreground mt-1">
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary mr-2">
                                                                            {items.length} items
                                                                        </span>
                                                                        {invoiceNumber && (
                                                                            <span className="font-mono text-xs mr-2">{invoiceNumber}</span>
                                                                        )}
                                                                        Subtotal: <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
                                                                    </p>
                                                                </>
                                                            )}
                                                        </div>
                                                        {isEditing && (
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleDeleteSupplier(supplier)}
                                                                className="shrink-0 gap-1.5"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                Hapus Supplier
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                                                        <div className="overflow-x-auto">
                                                            <Table>
                                                                <TableHeader className="bg-muted/40">
                                                                    <TableRow className="hover:bg-transparent">
                                                                        <TableHead className="w-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-4">No</TableHead>
                                                                        <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item Description</TableHead>
                                                                        <TableHead className="text-right w-20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</TableHead>
                                                                        <TableHead className="w-20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit</TableHead>
                                                                        <TableHead className="text-right min-w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</TableHead>
                                                                        <TableHead className="text-right min-w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground pr-4">Total</TableHead>
                                                                        {isEditing && (
                                                                            <TableHead className="w-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground"></TableHead>
                                                                        )}
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {items.map((item, index) => (
                                                                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                                                            <TableCell className="text-xs text-muted-foreground pl-4">{index + 1}</TableCell>
                                                                            <TableCell className="font-medium text-sm text-foreground">
                                                                                {isEditing ? (
                                                                                    <Input
                                                                                        value={item.item_name}
                                                                                        onChange={(e) => handleItemChange(item.id, 'item_name', e.target.value)}
                                                                                        className="h-8 text-sm"
                                                                                        placeholder="Nama barang..."
                                                                                    />
                                                                                ) : (
                                                                                    item.item_name
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="text-right text-sm">
                                                                                {isEditing ? (
                                                                                    <Input
                                                                                        type="number"
                                                                                        value={item.quantity}
                                                                                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                                                                        className="h-8 text-sm text-right w-20"
                                                                                        step="0.01"
                                                                                    />
                                                                                ) : (
                                                                                    item.quantity
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="text-xs text-muted-foreground">
                                                                                {isEditing ? (
                                                                                    <Input
                                                                                        value={item.unit}
                                                                                        onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                                                                                        className="h-8 text-xs w-20"
                                                                                    />
                                                                                ) : (
                                                                                    item.unit
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="text-right text-sm whitespace-nowrap font-mono text-muted-foreground">
                                                                                {isEditing ? (
                                                                                    <Input
                                                                                        type="number"
                                                                                        value={item.price}
                                                                                        onChange={(e) => handleItemChange(item.id, 'price', e.target.value)}
                                                                                        className="h-8 text-sm text-right font-mono w-28"
                                                                                        step="1000"
                                                                                    />
                                                                                ) : (
                                                                                    formatCurrency(item.price)
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-medium text-sm whitespace-nowrap font-mono pr-4">
                                                                                {formatCurrency(item.total)}
                                                                            </TableCell>
                                                                            {isEditing && (
                                                                                <TableCell className="pr-4">
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon-sm"
                                                                                        onClick={() => handleDeleteItem(item.id)}
                                                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                                        title="Hapus item"
                                                                                    >
                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                </TableCell>
                                                                            )}
                                                                        </TableRow>
                                                                    ))}

                                                                    {/* Subtotal row */}
                                                                    <TableRow className="bg-muted/20 font-semibold hover:bg-muted/30">
                                                                        <TableCell colSpan={isEditing ? 5 : 5} className="text-right text-sm pr-4 pl-4">
                                                                            Subtotal
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-sm font-mono pr-4">
                                                                            {formatCurrency(subtotal)}
                                                                        </TableCell>
                                                                        {isEditing && <TableCell />}
                                                                    </TableRow>
                                                                </TableBody>
                                                            </Table>
                                                        </div>

                                                        {/* Add Item Button */}
                                                        {isEditing && (
                                                            <div className="p-3 border-t bg-muted/20">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleAddItem(supplier)}
                                                                    className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
                                                                >
                                                                    <Plus className="h-3.5 w-3.5" />
                                                                    Tambah Item
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TabsContent>
                                            )
                                        })}
                                    </Tabs>
                                ) : (
                                    isEditing && (
                                        <div className="text-center py-8 border rounded-xl bg-muted/20">
                                            <p className="text-muted-foreground mb-3">Belum ada supplier</p>
                                            <Button
                                                variant="outline"
                                                onClick={() => setShowAddSupplier(true)}
                                                className="gap-1.5"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Tambah Supplier
                                            </Button>
                                        </div>
                                    )
                                )}

                                {/* Download Options (inline after save & download) */}
                                {showDownloadOptions && !isEditing && (
                                    <div className="border-t pt-6 mt-6">
                                        <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-5 space-y-4 animate-in fade-in-50 slide-in-from-top-2 duration-300">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                                <span className="font-semibold text-green-800">Perubahan disimpan! Pilih opsi download:</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <Button
                                                    variant="outline"
                                                    className="h-auto py-4 flex flex-col gap-2 items-center bg-white hover:bg-muted/50"
                                                    onClick={handleDownloadSeparate}
                                                    disabled={downloading}
                                                >
                                                    <Download className="h-5 w-5" />
                                                    <span className="text-sm font-medium">File Ini Saja</span>
                                                </Button>
                                                <Button
                                                    variant="default"
                                                    className="h-auto py-4 flex flex-col gap-2 items-center"
                                                    onClick={handleDownloadMerged}
                                                    disabled={downloading}
                                                >
                                                    <Files className="h-5 w-5" />
                                                    <span className="text-sm font-medium">Gabung Jadi 1 PDF</span>
                                                </Button>
                                                <Button
                                                    variant="default"
                                                    className="h-auto py-4 flex flex-col gap-2 items-center bg-zinc-800 hover:bg-zinc-700"
                                                    onClick={handleDownloadZip}
                                                    disabled={downloading}
                                                >
                                                    <FileArchive className="h-5 w-5" />
                                                    <span className="text-sm font-medium">Download ZIP ({suppliers.length} file)</span>
                                                </Button>
                                            </div>
                                            {downloading && (
                                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                    <span>Mengunduh...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Preview & Download Button */}
                                {!isEditing && (
                                    <div className="border-t pt-6 mt-6">
                                        <h4 className="text-sm font-medium mb-3 text-muted-foreground">Actions</h4>
                                        <Button
                                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md h-12"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                handlePreview()
                                            }}
                                            disabled={downloading}
                                            type="button"
                                        >
                                            {downloading ? (
                                                <>
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                                                    <span>{loadingStatus || 'Processing...'}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Eye className="mr-2 h-5 w-5" />
                                                    <span className="text-base font-medium">Preview & Download PDF</span>
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {/* Actions */}
                                {!isEditing && (
                                    <div className="flex gap-3 pt-6 mt-6 border-t">
                                        {invoice.status === 'generated' && (
                                            <Button
                                                variant="outline"
                                                size="lg"
                                                className="flex-1 shadow-sm hover:scale-[1.02] transition-transform border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                                                onClick={handleMarkComplete}
                                                disabled={markingComplete}
                                            >
                                                {markingComplete ? (
                                                    <>
                                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                                                        Memproses...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle className="mr-2 h-4 w-4" />
                                                        Tandai Selesai
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                        {invoice.status === 'completed' && (
                                            <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
                                                <CheckCircle className="h-5 w-5" />
                                                <span className="font-medium">Invoice Selesai</span>
                                            </div>
                                        )}
                                        <Button
                                            variant="destructive"
                                            size="lg"
                                            className="flex-1 shadow-sm hover:scale-[1.02] transition-transform"
                                            onClick={handleDelete}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Invoice
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Supplier Dialog */}
            <Dialog open={showAddSupplier} onOpenChange={setShowAddSupplier}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tambah Supplier Baru</DialogTitle>
                        <DialogDescription>
                            Masukkan nama supplier dan nomor invoice untuk supplier baru.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Nama Supplier</label>
                            <Input
                                value={newSupplierName}
                                onChange={(e) => setNewSupplierName(e.target.value)}
                                placeholder="Contoh: CV JAYAMEN"
                                className="mt-1"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Nomor Invoice</label>
                            <Input
                                value={newSupplierInvoiceNumber}
                                onChange={(e) => setNewSupplierInvoiceNumber(e.target.value)}
                                placeholder="#KWITANSI0001"
                                className="mt-1 font-mono"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setShowAddSupplier(false)}>
                                Batal
                            </Button>
                            <Button onClick={handleAddSupplier}>
                                <Plus className="h-4 w-4 mr-2" />
                                Tambah
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <FullScreenPDFPreview
                open={showPreview}
                onClose={() => setShowPreview(false)}
                pdfs={previewPDFs}
                onDownload={handleDownloadAll}
                batchName={invoice?.batch_name || undefined}
            />

            <DeleteConfirmationDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleConfirmDelete}
                loading={deleting}
            />
        </>
    )
}
