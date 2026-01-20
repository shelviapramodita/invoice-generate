import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X, FileArchive, FilePlus2 } from 'lucide-react'
import { GeneratedPDF } from '@/lib/pdf/pdf-generator'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface FullScreenPDFPreviewProps {
    open: boolean
    onClose: () => void
    pdfs: GeneratedPDF[]
    onDownload: () => void
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
            const filename = batchName
                ? `${batchName}-${selectedPdf.supplier}-${selectedPdf.invoiceNumber}.pdf`
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
        console.log('Merging PDFs:', pdfs.length, 'files')
        setDownloading(true)
        try {
            const { mergePDFs } = await import('@/lib/pdf/pdf-generator')
            const filename = batchName
                ? `${batchName}-All-Invoices-Merged.pdf`
                : `All-Invoices-Merged.pdf`
            console.log('Merged filename:', filename)
            await mergePDFs(pdfs, filename)
            console.log('Merge complete')
            toast.success('Download PDF Gabungan Berhasil!')
            // Keep dialog open
        } catch (error) {
            console.error('Error merging PDFs:', error)
            toast.error('Gagal menggabungkan PDF: ' + (error as Error).message)
        } finally {
            setDownloading(false)
        }
    }

    const handleDownloadAll = () => {
        console.log('Downloading all PDFs as ZIP')
        try {
            onDownload()
            toast.success('Download ZIP Berhasil!')
            // Keep dialog open
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
                            <p className="text-sm font-semibold mb-3 text-foreground">Daftar Invoice:</p>
                            <div className="space-y-2">
                                {pdfs.map((pdf, index) => (
                                    <button
                                        key={index}
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
                                    <span className="font-bold text-foreground">{pdfs.length} invoice</span>
                                    <span className="text-muted-foreground ml-1">siap di-download</span>
                                </div>
                                <Button variant="outline" onClick={handleClose} disabled={downloading}>
                                    <X className="mr-2 h-4 w-4" />
                                    Batal
                                </Button>
                            </div>
                        </div>

                        {/* Download Options */}
                        <div className="px-6 pb-4 pt-4">
                            <p className="text-xs font-medium text-muted-foreground mb-3">Pilih opsi download:</p>
                            <div className="grid grid-cols-3 gap-3">
                                <Button
                                    variant="outline"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        console.log('Action: Download Current')
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
                                        console.log('Action: Merge')
                                        handleDownloadMerged()
                                    }}
                                    disabled={downloading}
                                    className="w-full"
                                >
                                    <FilePlus2 className="mr-2 h-4 w-4" />
                                    {downloading ? 'Merging...' : 'Gabung Jadi 1 PDF'}
                                </Button>

                                <Button
                                    variant="default"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        console.log('Action: ZIP')
                                        handleDownloadAll()
                                    }}
                                    disabled={downloading}
                                    className="w-full"
                                >
                                    <FileArchive className="mr-2 h-4 w-4" />
                                    Download ZIP ({pdfs.length} file)
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
