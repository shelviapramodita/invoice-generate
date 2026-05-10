import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X, FileArchive, FilePlus2, ChevronDown, ChevronRight, Filter } from 'lucide-react'
import { GeneratedPDF } from '@/lib/pdf/pdf-generator'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'

// Helper to sanitize filename (remove/replace invalid characters)
function sanitizeFilename(name: string): string {
    return name
        .replace(/[\/\\:*?"<>|]/g, '-')  // Replace invalid chars with dash
        .replace(/\s+/g, ' ')             // Normalize spaces
        .trim()
}

// Convert "28-04-2026" → "28 Apr 2026" for nicer group headers.
const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
function formatGroupLabel(label: string): string {
    const m = label.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (!m) return label
    const day = parseInt(m[1], 10)
    const monthIdx = parseInt(m[2], 10) - 1
    const year = m[3]
    if (monthIdx < 0 || monthIdx > 11) return label
    return `${day} ${ID_MONTHS[monthIdx]} ${year}`
}

const NO_DATE_KEY = '__no_date__'

interface FullScreenPDFPreviewProps {
    open: boolean
    onClose: () => void
    pdfs: GeneratedPDF[]
    /**
     * Called when user clicks "Download ZIP". Receives the filtered list of PDFs
     * to download — when filter is "Semua tanggal", this is all pdfs; otherwise
     * only the pdfs in the currently-filtered date.
     */
    onDownload: (filteredPdfs: GeneratedPDF[]) => void
    batchName?: string
}

export function FullScreenPDFPreview({
    open,
    onClose,
    pdfs,
    onDownload,
    batchName
}: FullScreenPDFPreviewProps) {
    const [selectedPdf, setSelectedPdf] = useState<GeneratedPDF | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [downloading, setDownloading] = useState(false)
    // Filter: 'all' shows every group; otherwise the groupLabel of the only visible group
    const [filterDate, setFilterDate] = useState<string>('all')
    // Per-group collapsed state. Default: all expanded.
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

    // Group PDFs by their groupLabel (the per-day label set in upload page).
    // PDFs without groupLabel fall under NO_DATE_KEY and render without a header.
    const groups = useMemo(() => {
        const map = new Map<string, GeneratedPDF[]>()
        pdfs.forEach(pdf => {
            const key = pdf.groupLabel || NO_DATE_KEY
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(pdf)
        })
        // Sort groups chronologically by date string (DD-MM-YYYY → YYYY-MM-DD for compare)
        return Array.from(map.entries()).sort(([a], [b]) => {
            if (a === NO_DATE_KEY) return 1
            if (b === NO_DATE_KEY) return -1
            const ka = a.split('-').reverse().join('')
            const kb = b.split('-').reverse().join('')
            return ka.localeCompare(kb)
        })
    }, [pdfs])

    // Whether to show the filter UI at all (only useful when >1 day)
    const hasMultipleGroups = groups.length > 1 && !groups.some(([k]) => k === NO_DATE_KEY)

    // Apply the filter
    const visibleGroups = useMemo(() => {
        if (filterDate === 'all') return groups
        return groups.filter(([key]) => key === filterDate)
    }, [groups, filterDate])

    // Flat list of PDFs that are currently visible (respects filterDate).
    // Used as the source for "Gabung Jadi 1 PDF" and "Download ZIP" so the
    // download only includes invoices for the filtered date.
    const effectivePdfs = useMemo(() =>
        visibleGroups.flatMap(([, list]) => list),
        [visibleGroups]
    )

    const visibleCount = effectivePdfs.length

    // Pretty label for the filtered date, used in toasts and download filenames.
    const filterLabel = filterDate === 'all'
        ? 'Semua tanggal'
        : formatGroupLabel(filterDate)

    const toggleGroup = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    // Update preview URL when selected PDF changes
    const handleSelectPdf = (pdf: GeneratedPDF) => {
        setSelectedPdf(pdf)
        // Revoke previous URL to avoid memory leak
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }
        // Create new preview URL
        const url = URL.createObjectURL(pdf.blob)
        setPreviewUrl(url)
    }

    // Set initial preview when dialog opens or PDFs change
    useEffect(() => {
        if (open && pdfs.length > 0 && !selectedPdf) {
            handleSelectPdf(pdfs[0])
        }
    }, [open, pdfs])

    const handleClose = () => {
        // Cleanup
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
            setPreviewUrl(null)
        }
        setSelectedPdf(null)
        onClose()
    }

    // Handlers
    const handleDownloadCurrent = async () => {
        if (!selectedPdf) {
            console.error('No PDF selected')
            return
        }

        console.log('Downloading current PDF:', selectedPdf.supplier)
        setDownloading(true)
        try {
            const { downloadPDF } = await import('@/lib/pdf/pdf-generator')
            const safeBatchName = batchName ? sanitizeFilename(batchName) : null
            const filename = safeBatchName
                ? `${safeBatchName}-${selectedPdf.supplier}-${selectedPdf.invoiceNumber}.pdf`
                : `Invoice-${selectedPdf.supplier}-${selectedPdf.invoiceNumber}.pdf`
            console.log('Download filename:', filename)
            downloadPDF(selectedPdf.blob, filename)
            toast.success('Download PDF Berhasil!')
        } catch (error) {
            console.error('Error downloading PDF:', error)
            toast.error('Gagal mendownload PDF: ' + (error as Error).message)
        } finally {
            setDownloading(false)
        }
    }

    const handleDownloadMerged = async () => {
        if (effectivePdfs.length === 0) return
        console.log('Merging PDFs:', effectivePdfs.length, 'files for filter:', filterDate)
        setDownloading(true)
        try {
            const { mergePDFs } = await import('@/lib/pdf/pdf-generator')
            // Filename includes the filtered date when filter is active so
            // the user can tell which day's merged file is which.
            const baseLabel = batchName ? sanitizeFilename(batchName) : 'All-Invoices'
            const dateSuffix = filterDate !== 'all' ? `-${filterDate}` : ''
            const filename = `${baseLabel}${dateSuffix}-Merged.pdf`
            console.log('Merged filename:', filename)
            await mergePDFs(effectivePdfs, filename)
            console.log('Merge complete')
            toast.success(`Download PDF Gabungan Berhasil! (${effectivePdfs.length} invoice)`)
        } catch (error) {
            console.error('Error merging PDFs:', error)
            toast.error('Gagal menggabungkan PDF: ' + (error as Error).message)
        } finally {
            setDownloading(false)
        }
    }

    const handleDownloadAll = () => {
        if (effectivePdfs.length === 0) return
        console.log('Downloading PDFs as ZIP — filter:', filterDate, 'count:', effectivePdfs.length)
        try {
            // Pass the filtered list so the upload-page handler can name the ZIP
            // and limit contents to just the filtered date.
            onDownload(effectivePdfs)
            toast.success(`Download ZIP Berhasil! (${effectivePdfs.length} file)`)
        } catch (error) {
            console.error('Error downloading ZIP:', error)
            toast.error('Gagal mendownload ZIP: ' + (error as Error).message)
        }
    }

    const isLoading = pdfs.length === 0

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent
                className="max-w-[92vw] sm:max-w-[92vw] w-[92vw] h-[92vh] p-0 flex flex-col gap-0 overflow-hidden"
                showCloseButton={false}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b bg-background shrink-0">
                    <div className="flex items-start justify-between">
                        <div>
                            <DialogTitle className="text-lg font-bold">Preview Invoice PDF</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                {isLoading
                                    ? 'Memuat PDFs dari storage...'
                                    : `Review semua invoice sebelum download. Total: ${pdfs.length} file PDF`
                                }
                            </DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                            <p className="text-lg font-semibold">Mengunduh PDFs...</p>
                            <p className="text-sm text-muted-foreground mt-2">Harap tunggu sebentar</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
                        {/* Sidebar */}
                        <div className="w-80 flex-shrink-0 border rounded-lg p-4 overflow-y-auto bg-muted/20">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-foreground">Daftar Invoice</p>
                                <span className="text-xs text-muted-foreground">
                                    {visibleCount}{filterDate !== 'all' ? `/${pdfs.length}` : ''} file
                                </span>
                            </div>

                            {/* Filter dropdown — only when multiple days */}
                            {hasMultipleGroups && (
                                <div className="mb-3">
                                    <label className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                        <Filter className="h-3 w-3" />
                                        Filter tanggal
                                    </label>
                                    <select
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        className="w-full text-sm border rounded-md px-2 py-1.5 bg-background hover:border-primary/50 transition-colors cursor-pointer"
                                    >
                                        <option value="all">Semua tanggal ({pdfs.length})</option>
                                        {groups.map(([key, list]) => (
                                            <option key={key} value={key}>
                                                {formatGroupLabel(key)} ({list.length})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Grouped list */}
                            <div className="space-y-3">
                                {visibleGroups.map(([groupKey, list]) => {
                                    const collapsed = collapsedGroups.has(groupKey)
                                    const isNoDate = groupKey === NO_DATE_KEY
                                    return (
                                        <div key={groupKey}>
                                            {/* Group header — clickable to collapse, hidden if no date */}
                                            {!isNoDate && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleGroup(groupKey)}
                                                    className="w-full flex items-center gap-1.5 px-1 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-1.5"
                                                >
                                                    {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                    <span>{formatGroupLabel(groupKey)}</span>
                                                    <span className="ml-auto opacity-70">{list.length}</span>
                                                </button>
                                            )}

                                            {/* PDFs in this group */}
                                            {(!collapsed || isNoDate) && (
                                                <div className="space-y-2">
                                                    {list.map((pdf, idx) => (
                                                        <button
                                                            key={`${groupKey}-${idx}`}
                                                            onClick={() => handleSelectPdf(pdf)}
                                                            className={cn(
                                                                "w-full text-left p-3 rounded-lg border transition-all",
                                                                selectedPdf === pdf
                                                                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                                                                    : "hover:bg-muted hover:border-primary/20 hover:shadow-sm border-border"
                                                            )}
                                                        >
                                                            <div className="text-sm font-bold truncate">
                                                                {pdf.supplier}
                                                            </div>
                                                            <div className={cn(
                                                                "text-xs mt-1 font-mono",
                                                                selectedPdf === pdf ? "opacity-90" : "opacity-60"
                                                            )}>
                                                                {pdf.invoiceNumber}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex-1 border rounded-lg bg-white dark:bg-zinc-950 shadow-lg overflow-hidden">
                            {previewUrl ? (
                                <iframe
                                    src={`${previewUrl}#view=FitH&toolbar=1&navpanes=0&scrollbar=1`}
                                    className="w-full h-full border-0"
                                    title="PDF Preview"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <div className="text-center">
                                        <p className="text-lg font-medium">Pilih invoice untuk preview</p>
                                        <p className="text-sm mt-2 opacity-70">Klik salah satu invoice di sebelah kiri</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                {!isLoading && (
                    <div className="border-t bg-muted/20 shrink-0 relative z-10">
                        <div className="px-6 py-4 border-b">
                            <div className="flex items-center justify-between">
                                <div className="text-sm">
                                    {batchName && (
                                        <span className="font-semibold text-foreground">Batch: {batchName}</span>
                                    )}
                                    {batchName && <span className="mx-2 text-muted-foreground">•</span>}
                                    <span className="font-bold text-foreground">{visibleCount} invoice</span>
                                    <span className="text-muted-foreground ml-1">
                                        {filterDate === 'all' ? 'siap di-download' : `dari ${filterLabel}`}
                                    </span>
                                </div>
                                <Button variant="outline" onClick={handleClose} disabled={downloading}>
                                    <X className="mr-2 h-4 w-4" />
                                    Batal
                                </Button>
                            </div>
                        </div>

                        {/* Download Options */}
                        <div className="px-6 pb-4 pt-4">
                            <p className="text-xs font-medium text-muted-foreground mb-3">
                                Pilih opsi download:
                                {filterDate !== 'all' && (
                                    <span className="ml-1 text-primary font-semibold">
                                        (filter: {filterLabel})
                                    </span>
                                )}
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                <Button
                                    variant="outline"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleDownloadCurrent()
                                    }}
                                    disabled={!selectedPdf || downloading}
                                    className="w-full"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    File Ini Saja
                                </Button>

                                <Button
                                    variant="default"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleDownloadMerged()
                                    }}
                                    disabled={downloading || effectivePdfs.length === 0}
                                    className="w-full"
                                >
                                    <FilePlus2 className="mr-2 h-4 w-4" />
                                    {downloading ? 'Merging...' : `Gabung Jadi 1 PDF (${effectivePdfs.length})`}
                                </Button>

                                <Button
                                    variant="default"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleDownloadAll()
                                    }}
                                    disabled={downloading || effectivePdfs.length === 0}
                                    className="w-full"
                                >
                                    <FileArchive className="mr-2 h-4 w-4" />
                                    Download ZIP ({effectivePdfs.length} file)
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
