'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Calendar as CalendarIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ExcelUploader } from '@/components/excel/excel-uploader'
import { SheetPicker } from '@/components/excel/sheet-picker'
import { InvoicePreview } from '@/components/invoice/invoice-preview'
import { FullScreenPDFPreview } from '@/components/invoice/fullscreen-pdf-preview'
import { CustomerNameInput } from '@/components/invoice/customer-name-input'
import { SheetEntry } from '@/types'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Per-sheet configuration the user fills in before generating
interface SheetConfig {
    invoiceDate: Date
    batchName: string
    invoiceNumbers: Record<string, string> // keyed by supplier
    customerNames: Record<string, string> // keyed by supplier
}

// One PDF returned from the API, with the source sheet so we can label it
interface GeneratedPDFEntry {
    supplier: string
    invoiceNumber: string
    blob: Blob
    sheetName: string
    groupLabel?: string
}

function defaultBatchName(date: Date): string {
    return `Kwitansi SPPG Tambak - ${format(date, 'dd/MM/yyyy')}`
}

function buildSheetConfig(sheet: SheetEntry): SheetConfig {
    const date = sheet.detectedDate ? new Date(sheet.detectedDate + 'T12:00:00') : new Date()
    const numbers: Record<string, string> = {}
    const customers: Record<string, string> = {}
    const suppliers = sheet.data ? Object.keys(sheet.data) : []
    suppliers.forEach((supplier, index) => {
        numbers[supplier] = `#KWITANSI${String(index + 1).padStart(4, '0')}`
        customers[supplier] = 'SPPG Tambak'
    })
    return {
        invoiceDate: date,
        batchName: defaultBatchName(date),
        invoiceNumbers: numbers,
        customerNames: customers,
    }
}

export default function UploadPage() {
    const [sheets, setSheets] = useState<SheetEntry[]>([])
    const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([])
    const [configs, setConfigs] = useState<Record<string, SheetConfig>>({})
    const [previewSheetName, setPreviewSheetName] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
    const [showPreview, setShowPreview] = useState(false)
    const [generatedPDFs, setGeneratedPDFs] = useState<GeneratedPDFEntry[]>([])

    const handleParsed = (parsedSheets: SheetEntry[]) => {
        setSheets(parsedSheets)

        // Auto-select all single-day sheets by default; multi-day stays unchecked
        const autoSelect = parsedSheets.filter(s => s.type === 'single-day').map(s => s.sheetName)
        setSelectedSheetNames(autoSelect)

        // Pre-build config for every sheet so user edits don't reset on re-select
        const initial: Record<string, SheetConfig> = {}
        parsedSheets.forEach(s => {
            initial[s.sheetName] = buildSheetConfig(s)
        })
        setConfigs(initial)

        // Open preview for first selected sheet
        setPreviewSheetName(autoSelect[0] || parsedSheets[0]?.sheetName || null)
    }

    const updateConfig = (sheetName: string, patch: Partial<SheetConfig>) => {
        setConfigs(prev => ({
            ...prev,
            [sheetName]: { ...prev[sheetName], ...patch },
        }))
    }

    const handleGenerate = async () => {
        if (selectedSheetNames.length === 0) {
            toast.error('Pilih minimal 1 hari untuk di-generate')
            return
        }

        // Save customer names for autocomplete
        const STORAGE_KEY = 'recent-customer-names'
        const MAX_RECENT = 5
        const stored = localStorage.getItem(STORAGE_KEY)
        let recentNames: string[] = []
        if (stored) {
            try { recentNames = JSON.parse(stored) } catch { recentNames = [] }
        }
        selectedSheetNames.forEach(sheetName => {
            const cfg = configs[sheetName]
            if (!cfg) return
            Object.values(cfg.customerNames).forEach(name => {
                if (name && name.trim().length >= 2) {
                    const trimmed = name.trim()
                    recentNames = [trimmed, ...recentNames.filter(n => n !== trimmed)]
                }
            })
        })
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recentNames.slice(0, MAX_RECENT)))

        setGenerating(true)
        setProgress({ done: 0, total: selectedSheetNames.length })

        const allPDFs: GeneratedPDFEntry[] = []

        try {
            for (let i = 0; i < selectedSheetNames.length; i++) {
                const sheetName = selectedSheetNames[i]
                const sheet = sheets.find(s => s.sheetName === sheetName)
                const cfg = configs[sheetName]

                if (!sheet?.data || !cfg) {
                    toast.error(`Sheet "${sheetName}" tidak memiliki data`)
                    continue
                }

                const response = await fetch('/api/generate-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        parsedData: sheet.data,
                        invoiceDate: format(cfg.invoiceDate, 'yyyy-MM-dd'),
                        batchName: cfg.batchName || undefined,
                        invoiceNumbers: cfg.invoiceNumbers,
                        customerNames: cfg.customerNames,
                    }),
                })

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}))
                    throw new Error(`Gagal generate "${sheet.label}": ${err.error || response.statusText}`)
                }

                const data = await response.json()
                data.pdfs.forEach((pdf: any) => {
                    allPDFs.push({
                        supplier: pdf.supplier,
                        invoiceNumber: pdf.invoiceNumber,
                        blob: base64ToBlob(pdf.blob, 'application/pdf'),
                        sheetName,
                        // groupLabel makes the preview sidebar + ZIP folder show the day this PDF belongs to
                        // when the user generated multiple days at once.
                        groupLabel: format(cfg.invoiceDate, 'dd-MM-yyyy'),
                    })
                })

                setProgress({ done: i + 1, total: selectedSheetNames.length })
            }

            setGeneratedPDFs(allPDFs)
            setShowPreview(true)
            toast.success(`Berhasil generate ${allPDFs.length} PDF dari ${selectedSheetNames.length} hari`)
        } catch (error: any) {
            console.error('Error generating:', error)
            toast.error(error.message || 'Gagal generate PDF')
        } finally {
            setGenerating(false)
            setProgress(null)
        }
    }

    const handleClosePreview = () => {
        setShowPreview(false)
        setSheets([])
        setSelectedSheetNames([])
        setConfigs({})
        setPreviewSheetName(null)
        setGeneratedPDFs([])
    }

    const handleDownloadPDFs = async () => {
        const { downloadAllPDFs } = await import('@/lib/pdf/pdf-generator')
        // For multi-day batches, name the ZIP after the date range
        const dates = selectedSheetNames
            .map(n => configs[n]?.invoiceDate)
            .filter((d): d is Date => !!d)
            .sort((a, b) => a.getTime() - b.getTime())
        let zipBatchName: string | undefined
        if (dates.length === 1) {
            zipBatchName = configs[selectedSheetNames[0]]?.batchName
        } else if (dates.length > 1) {
            zipBatchName = `Kwitansi SPPG Tambak - ${format(dates[0], 'dd-MM-yyyy')} sd ${format(dates[dates.length - 1], 'dd-MM-yyyy')}`
        }
        await downloadAllPDFs(generatedPDFs, zipBatchName)
    }

    const base64ToBlob = (base64: string, type: string): Blob => {
        const byteCharacters = atob(base64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i)
        return new Blob([new Uint8Array(byteNumbers)], { type })
    }

    const previewSheet = previewSheetName ? sheets.find(s => s.sheetName === previewSheetName) : null
    const previewConfig = previewSheetName ? configs[previewSheetName] : null
    const previewSuppliers = previewSheet?.data ? Object.keys(previewSheet.data) : []

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <Link href="/">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Kembali
                        </Button>
                    </Link>
                </div>

                <div className="max-w-5xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Excel</h1>
                        <p className="text-muted-foreground">
                            Upload file RAB master atau file harian. Semua sheet akan terdeteksi otomatis.
                        </p>
                    </div>

                    {/* Step 1: Upload */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                1. Upload File
                            </CardTitle>
                            <CardDescription>
                                Pilih file Excel — bisa file harian (1 sheet) atau RAB master (banyak sheet per hari)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ExcelUploader onParsed={handleParsed} />
                        </CardContent>
                    </Card>

                    {/* Step 2: Pick sheets */}
                    {sheets.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CalendarIcon className="h-5 w-5" />
                                    2. Pilih Hari
                                </CardTitle>
                                <CardDescription>
                                    Pilih satu atau beberapa hari yang ingin di-generate invoice-nya
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <SheetPicker
                                    sheets={sheets}
                                    selectedSheetNames={selectedSheetNames}
                                    onChange={setSelectedSheetNames}
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 3: Configure each selected day */}
                    {selectedSheetNames.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>3. Pengaturan Invoice per Hari</CardTitle>
                                <CardDescription>
                                    {selectedSheetNames.length === 1
                                        ? 'Atur tanggal, batch name, nomor kwitansi, dan customer'
                                        : `${selectedSheetNames.length} hari dipilih — atur masing-masing di tab di bawah`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Tab strip */}
                                {selectedSheetNames.length > 1 && (
                                    <div className="flex gap-1 overflow-x-auto pb-2 border-b">
                                        {selectedSheetNames.map(sheetName => {
                                            const sheet = sheets.find(s => s.sheetName === sheetName)
                                            const isActive = previewSheetName === sheetName
                                            return (
                                                <button
                                                    key={sheetName}
                                                    type="button"
                                                    onClick={() => setPreviewSheetName(sheetName)}
                                                    className={`px-3 py-1.5 text-xs rounded-t-md whitespace-nowrap transition-colors ${
                                                        isActive
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-muted hover:bg-muted/70'
                                                    }`}
                                                >
                                                    {sheet?.label || sheetName}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {previewConfig && previewSheet && (
                                    <div className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Tanggal Invoice</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            className={cn(
                                                                'w-full justify-start text-left font-normal',
                                                                !previewConfig.invoiceDate && 'text-muted-foreground'
                                                            )}
                                                        >
                                                            {previewConfig.invoiceDate
                                                                ? format(previewConfig.invoiceDate, 'dd MMMM yyyy', { locale: id })
                                                                : 'Pilih tanggal'}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={previewConfig.invoiceDate}
                                                            onSelect={(date) => {
                                                                if (!date) return
                                                                updateConfig(previewSheet.sheetName, {
                                                                    invoiceDate: date,
                                                                    batchName: defaultBatchName(date),
                                                                })
                                                            }}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <p className="text-xs text-muted-foreground">
                                                    Auto-detect: {previewSheet.label}
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Nama Batch</Label>
                                                <Input
                                                    value={previewConfig.batchName}
                                                    onChange={(e) =>
                                                        updateConfig(previewSheet.sheetName, { batchName: e.target.value })
                                                    }
                                                    placeholder="Kwitansi SPPG Tambak - 21/01/2026"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <Label>Nomor Kwitansi per Supplier</Label>
                                            <div className="space-y-2">
                                                {previewSuppliers.map(supplier => (
                                                    <div key={supplier} className="flex items-center gap-3">
                                                        <Label className="w-48 text-sm truncate" title={supplier}>
                                                            {supplier}
                                                        </Label>
                                                        <Input
                                                            value={previewConfig.invoiceNumbers[supplier] || ''}
                                                            onChange={(e) =>
                                                                updateConfig(previewSheet.sheetName, {
                                                                    invoiceNumbers: {
                                                                        ...previewConfig.invoiceNumbers,
                                                                        [supplier]: e.target.value,
                                                                    },
                                                                })
                                                            }
                                                            placeholder="#KWITANSI0001"
                                                            className="flex-1"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <Label>Tagihan Kepada (per Supplier)</Label>
                                            <div className="space-y-2">
                                                {previewSuppliers.map(supplier => (
                                                    <CustomerNameInput
                                                        key={supplier}
                                                        supplier={supplier}
                                                        value={previewConfig.customerNames[supplier] || ''}
                                                        onChange={(value) =>
                                                            updateConfig(previewSheet.sheetName, {
                                                                customerNames: {
                                                                    ...previewConfig.customerNames,
                                                                    [supplier]: value,
                                                                },
                                                            })
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Preview tab content (data of currently-active sheet) */}
                    {previewSheet?.data && selectedSheetNames.includes(previewSheet.sheetName) && (
                        <InvoicePreview data={previewSheet.data} />
                    )}

                    {/* Generate button */}
                    {selectedSheetNames.length > 0 && (
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSheets([])
                                    setSelectedSheetNames([])
                                    setConfigs({})
                                    setPreviewSheetName(null)
                                }}
                            >
                                Batal
                            </Button>
                            <Button onClick={handleGenerate} disabled={generating}>
                                {generating ? (
                                    <>
                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        {progress
                                            ? `Generating ${progress.done}/${progress.total}...`
                                            : 'Generating...'}
                                    </>
                                ) : (
                                    `Preview & Download ${selectedSheetNames.length} Invoice`
                                )}
                            </Button>
                        </div>
                    )}
                </div>

                <FullScreenPDFPreview
                    open={showPreview}
                    onClose={handleClosePreview}
                    pdfs={generatedPDFs}
                    onDownload={handleDownloadPDFs}
                    batchName={
                        selectedSheetNames.length === 1
                            ? configs[selectedSheetNames[0]]?.batchName
                            : `${selectedSheetNames.length} hari`
                    }
                />
            </div>
        </div>
    )
}
