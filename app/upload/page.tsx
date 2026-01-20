'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ExcelUploader } from '@/components/excel/excel-uploader'
import { InvoicePreview } from '@/components/invoice/invoice-preview'
import { FullScreenPDFPreview } from '@/components/invoice/fullscreen-pdf-preview'
import { ParsedExcelData } from '@/types'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export default function UploadPage() {
    const [parsedData, setParsedData] = useState<ParsedExcelData | null>(null)
    const [invoiceDate, setInvoiceDate] = useState<Date>(new Date())
    const [batchName, setBatchName] = useState<string>('')
    const [generating, setGenerating] = useState(false)
    const [invoiceNumbers, setInvoiceNumbers] = useState<Record<string, string>>({})
    const [showPreview, setShowPreview] = useState(false)
    const [generatedPDFs, setGeneratedPDFs] = useState<any[]>([])

    const handleParsed = (data: ParsedExcelData) => {
        setParsedData(data)
        // Auto-fill batch name with month-year
        const defaultBatch = format(new Date(), 'MMMM yyyy', { locale: id })
        setBatchName(defaultBatch)

        // Initialize invoice numbers with auto-increment
        const numbers: Record<string, string> = {}
        Object.keys(data).forEach((supplier, index) => {
            numbers[supplier] = `#KWITANSI${String(index + 1).padStart(4, '0')}`
        })
        setInvoiceNumbers(numbers)
    }

    const handleGenerate = async () => {
        if (!parsedData) return

        setGenerating(true)

        try {
            // Call API route to generate PDFs on server-side
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parsedData,
                    invoiceDate: invoiceDate.toISOString(),
                    batchName: batchName || undefined,
                    invoiceNumbers,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.details || 'Failed to generate PDFs')
            }

            const data = await response.json()

            // Convert base64 back to blobs
            const pdfs = data.pdfs.map((pdf: any) => ({
                supplier: pdf.supplier,
                invoiceNumber: pdf.invoiceNumber,
                blob: base64ToBlob(pdf.blob, 'application/pdf'),
            }))

            setGeneratedPDFs(pdfs)
            setShowPreview(true)
        } catch (error) {
            console.error('Error generating PDF:', error)
            alert('Gagal generate PDF. Silakan coba lagi.\n\nError: ' + (error as Error).message)
        } finally {
            setGenerating(false)
        }
    }

    const handleDownloadPDFs = async () => {
        const { downloadAllPDFs } = await import('@/lib/pdf/pdf-generator')
        await downloadAllPDFs(generatedPDFs, batchName || undefined)
        // Don't reset state here - keep modal open
        // User can continue downloading or close manually
    }

    // Called when user closes the preview modal - reset to fresh state
    const handleClosePreview = () => {
        setShowPreview(false)
        // Reset all state to fresh upload page
        setParsedData(null)
        setGeneratedPDFs([])
        setBatchName('')
        setInvoiceNumbers({})
        setInvoiceDate(new Date())
    }

    // Helper to convert base64 to Blob
    const base64ToBlob = (base64: string, type: string): Blob => {
        const byteCharacters = atob(base64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        return new Blob([byteArray], { type })
    }

    const canGenerate = parsedData !== null && invoiceDate !== null

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Kembali
                        </Button>
                    </Link>
                </div>

                {/* Main Content */}
                <div className="max-w-4xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">
                            Upload Excel
                        </h1>
                        <p className="text-muted-foreground">
                            Upload file Excel untuk generate invoice PDF
                        </p>
                    </div>

                    {/* Upload Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Upload File
                            </CardTitle>
                            <CardDescription>
                                Pilih file Excel (.xlsx, .xls, .csv) yang berisi data invoice
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ExcelUploader onParsed={handleParsed} />
                        </CardContent>
                    </Card>

                    {/* Settings Section */}
                    {parsedData && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Pengaturan Invoice</CardTitle>
                                <CardDescription>
                                    Atur tanggal dan nama batch untuk invoice
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    {/* Invoice Date */}
                                    <div className="space-y-2">
                                        <Label htmlFor="invoiceDate">Tanggal Invoice</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        'w-full justify-start text-left font-normal',
                                                        !invoiceDate && 'text-muted-foreground'
                                                    )}
                                                >
                                                    {invoiceDate ? (
                                                        format(invoiceDate, 'dd MMMM yyyy', { locale: id })
                                                    ) : (
                                                        'Pilih tanggal'
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={invoiceDate}
                                                    onSelect={(date) => date && setInvoiceDate(date)}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Batch Name */}
                                    <div className="space-y-2">
                                        <Label htmlFor="batchName">Nama Batch (opsional)</Label>
                                        <Input
                                            id="batchName"
                                            value={batchName}
                                            onChange={(e) => setBatchName(e.target.value)}
                                            placeholder="Contoh: Januari 2024"
                                        />
                                    </div>
                                </div>

                                {/* Custom Invoice Numbers */}
                                <div className="space-y-3 pt-2">
                                    <Label>Nomor Kwitansi per Supplier</Label>
                                    <div className="space-y-2">
                                        {Object.keys(parsedData).map((supplier) => (
                                            <div key={supplier} className="flex items-center gap-3">
                                                <Label className="w-48 text-sm truncate" title={supplier}>
                                                    {supplier}
                                                </Label>
                                                <Input
                                                    value={invoiceNumbers[supplier] || ''}
                                                    onChange={(e) => setInvoiceNumbers({
                                                        ...invoiceNumbers,
                                                        [supplier]: e.target.value
                                                    })}
                                                    placeholder="#KWITANSI0001"
                                                    className="flex-1"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Setiap supplier akan mendapat nomor kwitansi yang berbeda
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Preview Section */}
                    {parsedData && (
                        <InvoicePreview data={parsedData} />
                    )}

                    {/* Generate Button */}
                    {parsedData && (
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setParsedData(null)
                                }}
                            >
                                Batal
                            </Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={!canGenerate || generating}
                            >
                                {generating ? (
                                    <>
                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Generating...
                                    </>
                                ) : (
                                    'Preview & Download PDF'
                                )}
                            </Button>
                        </div>
                    )}
                </div>

                {/* PDF Preview - Full Screen */}
                <FullScreenPDFPreview
                    open={showPreview}
                    onClose={handleClosePreview}
                    pdfs={generatedPDFs}
                    onDownload={handleDownloadPDFs}
                    batchName={batchName}
                />
            </div>
        </div>
    )
}
