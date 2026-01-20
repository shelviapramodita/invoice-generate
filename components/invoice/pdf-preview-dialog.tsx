'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'
import { GeneratedPDF } from '@/lib/pdf/pdf-generator'
import { cn } from '@/lib/utils'

interface PDFPreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    pdfs: GeneratedPDF[]
    onDownload: () => void
    batchName?: string
}

export function PDFPreviewDialog({ 
    open, 
    onOpenChange, 
    pdfs, 
    onDownload,
    batchName 
}: PDFPreviewDialogProps) {
    const [selectedPdf, setSelectedPdf] = useState<GeneratedPDF | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

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
        onOpenChange(false)
    }

    const handleDownloadAndClose = () => {
        onDownload()
        handleClose()
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent 
                className="!max-w-[96vw] !w-[96vw] h-[96vh] flex flex-col p-0 gap-0"
                style={{ maxWidth: '96vw', width: '96vw' }}
                showCloseButton={false}
            >
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <DialogTitle className="text-xl">Preview Invoice PDF</DialogTitle>
                    <DialogDescription>
                        Review semua invoice sebelum download. Total: {pdfs.length} file PDF
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex gap-6 px-6 py-4 min-h-0 overflow-hidden">
                    {/* PDF List Sidebar */}
                    <div className="w-80 flex-shrink-0 border rounded-lg p-4 overflow-y-auto bg-background shadow-sm">
                        <p className="text-sm font-semibold mb-3 text-foreground">Daftar Invoice:</p>
                        <div className="space-y-2">
                            {pdfs.map((pdf, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSelectPdf(pdf)}
                                    className={cn(
                                        "w-full text-left p-4 rounded-lg border transition-all",
                                        selectedPdf === pdf 
                                            ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]" 
                                            : "hover:bg-muted hover:border-muted-foreground/30 hover:shadow"
                                    )}
                                >
                                    <div className="text-sm font-bold truncate">
                                        {pdf.supplier}
                                    </div>
                                    <div className={cn(
                                        "text-xs mt-1.5 font-mono",
                                        selectedPdf === pdf ? "opacity-90" : "opacity-70"
                                    )}>
                                        {pdf.invoiceNumber}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PDF Preview - Much Larger */}
                    <div className="flex-1 border-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 shadow-lg overflow-hidden flex flex-col">
                        {previewUrl ? (
                            <iframe
                                src={`${previewUrl}#view=FitH&toolbar=1&navpanes=0`}
                                className="w-full h-full border-0"
                                title="PDF Preview"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center">
                                    <p className="text-xl font-medium">Pilih invoice untuk preview</p>
                                    <p className="text-sm mt-3 opacity-70">Klik salah satu invoice di sebelah kiri</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between items-center px-6 py-5 border-t bg-muted/30 shrink-0">
                    <div className="text-sm">
                        {batchName && (
                            <span className="font-semibold text-foreground">Batch: {batchName}</span>
                        )}
                        {batchName && <span className="mx-2 text-muted-foreground">•</span>}
                        <span className="font-bold text-foreground">{pdfs.length} invoice</span>
                        <span className="text-muted-foreground ml-1">siap di-download</span>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={handleClose} size="lg">
                            <X className="mr-2 h-5 w-5" />
                            Batal
                        </Button>
                        <Button onClick={handleDownloadAndClose} size="lg" className="px-6">
                            <Download className="mr-2 h-5 w-5" />
                            Download Semua
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
