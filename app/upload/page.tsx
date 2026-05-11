'use client'

import { useState, useEffect } from 'react'
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
import { SheetEntry, SheetCategory } from '@/types'
import { extractSppgNameFromFilename } from '@/lib/text-normalizer'
import type { GeneratedPDF } from '@/lib/pdf/pdf-generator'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const CATEGORY_LABELS: Record<SheetCategory, string> = {
    'operasional': 'Operasional',
    'operasional-galon': 'Operasional Galon',
}

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
    batchName?: string
}

/**
 * Build the auto-detected batch name for a sheet.
 * Format: "Kwitansi SPPG <Name> - [<Category> ]DD/MM/YYYY"
 *   "RAB SPPG Tambak.xlsx" + "8 APRIL 2026 DONE" → "Kwitansi SPPG Tambak - 08/04/2026"
 *   "RAB SPPG Tambak.xlsx" + "OPS 8 APRIL 2026" → "Kwitansi SPPG Tambak - Operasional 08/04/2026"
 *   "RAB SPPG Tambak.xlsx" + "OPS GALON 8 APRIL 2026" → "Kwitansi SPPG Tambak - Operasional Galon 08/04/2026"
 */
function defaultBatchName(date: Date, sppgName: string, category?: SheetCategory): string {
    const dateStr = format(date, 'dd/MM/yyyy')
    const sppg = sppgName ? `SPPG ${sppgName}` : 'SPPG'
    const categoryStr = category ? `${CATEGORY_LABELS[category]} ` : ''
    return `Kwitansi ${sppg} - ${categoryStr}${dateStr}`
}

/** Format an integer into "#KWITANSI0001"-style invoice number (4-digit zero-padded). */
function formatInvoiceNumber(n: number): string {
    return `#KWITANSI${String(n).padStart(4, '0')}`
}

/**
 * Build the initial config for a sheet. The invoice number is shared across
 * all suppliers (one number per day, all 3 CV use the same kwitansi number).
 * The actual sequential numbering across selected sheets is applied later via
 * the auto-recompute effect — here we just set a placeholder that gets
 * overwritten as soon as the user selects this sheet.
 */
function buildSheetConfig(sheet: SheetEntry, sppgName: string): SheetConfig {
    const date = sheet.detectedDate ? new Date(sheet.detectedDate + 'T12:00:00') : new Date()
    const numbers: Record<string, string> = {}
    const customers: Record<string, string> = {}
    const suppliers = sheet.data ? Object.keys(sheet.data) : []
    const customerName = sppgName ? `SPPG ${sppgName}` : 'SPPG Tambak'
    // Same kwitansi number for every supplier in this sheet — the auto-recompute
    // effect will assign the real sequential number when the user picks this sheet.
    const placeholderNumber = formatInvoiceNumber(1)
    suppliers.forEach((supplier) => {
        numbers[supplier] = placeholderNumber
        customers[supplier] = customerName
    })
    return {
        invoiceDate: date,
        batchName: defaultBatchName(date, sppgName, sheet.category),
        invoiceNumbers: numbers,
        customerNames: customers,
    }
}

const STARTING_NUMBER_STORAGE_KEY = 'starting-invoice-number'

export default function UploadPage() {
    const [sheets, setSheets] = useState<SheetEntry[]>([])
    const [sppgName, setSppgName] = useState<string>('Tambak') // detected from filename
    const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([])
    const [configs, setConfigs] = useState<Record<string, SheetConfig>>({})
    const [previewSheetName, setPreviewSheetName] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
    const [showPreview, setShowPreview] = useState(false)
    const [generatedPDFs, setGeneratedPDFs] = useState<GeneratedPDFEntry[]>([])
    // Starting invoice number (used as base for sequential numbering across
    // selected sheets). Persisted to localStorage so user doesn't need to
    // re-enter every session — they just continue from where they left off.
    const [startingNumber, setStartingNumber] = useState<number>(1)

    // Load starting number from localStorage on mount
    useEffect(() => {
        if (typeof window === 'undefined') return
        const stored = localStorage.getItem(STARTING_NUMBER_STORAGE_KEY)
        if (stored) {
            const n = parseInt(stored, 10)
            if (!isNaN(n) && n > 0) setStartingNumber(n)
        }
    }, [])

    // Persist starting number whenever it changes
    useEffect(() => {
        if (typeof window === 'undefined') return
        localStorage.setItem(STARTING_NUMBER_STORAGE_KEY, String(startingNumber))
    }, [startingNumber])

    // When the user edits the SPPG name (or it gets re-detected on new upload),
    // propagate the change to all per-sheet configs: rewrite batch names to
    // include the new SPPG and update each supplier's customer_name ("Tagihan
    // Kepada"). Runs whenever sppgName changes.
    useEffect(() => {
        if (sheets.length === 0) return
        setConfigs(prev => {
            const updated = { ...prev }
            Object.keys(updated).forEach(sheetName => {
                const sheet = sheets.find(s => s.sheetName === sheetName)
                if (!sheet) return
                const cfg = updated[sheetName]
                const newBatchName = defaultBatchName(cfg.invoiceDate, sppgName, sheet.category)
                const newCustomer = sppgName ? `SPPG ${sppgName}` : ''
                const newCustomerNames: Record<string, string> = {}
                Object.keys(cfg.customerNames).forEach(supplier => {
                    newCustomerNames[supplier] = newCustomer
                })
                updated[sheetName] = {
                    ...cfg,
                    batchName: newBatchName,
                    customerNames: newCustomerNames,
                }
            })
            return updated
        })
    // configs intentionally excluded to avoid loop on its own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sppgName, sheets])

    // Auto-recompute kwitansi numbers across selected sheets in chronological order.
    // One number per sheet (date), shared across all 3 suppliers in that sheet.
    // Triggers when selection changes or starting number changes.
    useEffect(() => {
        if (selectedSheetNames.length === 0) return

        const sortedSelected = [...selectedSheetNames].sort((a, b) => {
            const sa = sheets.find(s => s.sheetName === a)
            const sb = sheets.find(s => s.sheetName === b)
            const da = sa?.detectedDate || sa?.dateRangeStart || ''
            const db = sb?.detectedDate || sb?.dateRangeStart || ''
            return da.localeCompare(db)
        })

        setConfigs(prev => {
            const updated = { ...prev }
            sortedSelected.forEach((sheetName, i) => {
                const cfg = updated[sheetName]
                if (!cfg) return
                const newNumber = formatInvoiceNumber(startingNumber + i)
                // Only update if it actually differs — avoids unnecessary re-renders
                const suppliers = Object.keys(cfg.invoiceNumbers)
                const allSame = suppliers.every(s => cfg.invoiceNumbers[s] === newNumber)
                if (allSame) return
                const newInvoiceNumbers: Record<string, string> = {}
                suppliers.forEach(s => { newInvoiceNumbers[s] = newNumber })
                updated[sheetName] = { ...cfg, invoiceNumbers: newInvoiceNumbers }
            })
            return updated
        })
    // sheets is included so re-parse triggers recompute, but configs is omitted
    // to prevent the effect from looping on its own state writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSheetNames, startingNumber, sheets])

    const handleParsed = (parsedSheets: SheetEntry[], fileName: string) => {
        // Detect SPPG name from filename. If extraction fails (no SPPG marker
        // found and nothing left after stripping noise), leave empty so the
        // user is forced to fill in the field below.
        const detectedSppg = extractSppgNameFromFilename(fileName) || ''
        setSppgName(detectedSppg)
        setSheets(parsedSheets)

        // Start with NO sheets selected. User explicitly picks the days they want
        // — saves them from having to unselect dozens of dates they don't need.
        setSelectedSheetNames([])

        // Pre-build config for every sheet so user edits don't reset on re-select
        const initial: Record<string, SheetConfig> = {}
        parsedSheets.forEach(s => {
            initial[s.sheetName] = buildSheetConfig(s, detectedSppg)
        })
        setConfigs(initial)

        // No preview until user picks a sheet
        setPreviewSheetName(null)
    }

    /**
     * Wrap setSelectedSheetNames so the preview tab auto-follows the selection:
     *   - If selection becomes empty → previewSheetName=null (config card hides).
     *   - If current preview isn't in new selection → switch to first selected.
     *   - Otherwise leave preview alone.
     * This way the user never has to manually pick a "preview tab" — picking a
     * checkbox is enough.
     */
    const handleSelectionChange = (newSelection: string[]) => {
        setSelectedSheetNames(newSelection)
        if (newSelection.length === 0) {
            setPreviewSheetName(null)
        } else if (!previewSheetName || !newSelection.includes(previewSheetName)) {
            setPreviewSheetName(newSelection[0])
        }
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
                        // batchName is what the user typed in "Nama Batch". It flows through to:
                        //   - ZIP folder name (so ZIP structure mirrors what user sees in UI)
                        //   - Single PDF download filename prefix
                        //   - Merged PDF filename prefix
                        batchName: cfg.batchName,
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

    /**
     * Called from the preview modal's "Download ZIP" button. The preview passes
     * the filtered list of PDFs (which respects the date-filter dropdown), so
     * this handler downloads just that subset and names the ZIP based on the
     * actual dates in the filtered list — not the full selection.
     */
    const handleDownloadPDFs = async (filteredPdfs: GeneratedPDF[]) => {
        if (!filteredPdfs || filteredPdfs.length === 0) return
        const { downloadAllPDFs } = await import('@/lib/pdf/pdf-generator')

        // Derive the date range from the actual PDFs being downloaded.
        // groupLabel is "DD-MM-YYYY"; sort lex after reversing to YYYY-MM-DD.
        const groupLabels = Array.from(
            new Set(filteredPdfs.map(p => p.groupLabel).filter((g): g is string => !!g))
        ).sort((a, b) => a.split('-').reverse().join('').localeCompare(b.split('-').reverse().join('')))

        const sppg = sppgName ? `SPPG ${sppgName}` : 'SPPG'
        let zipBatchName: string | undefined
        if (groupLabels.length === 1) {
            // Single date — find the sheet config whose date matches this groupLabel
            // so we can reuse its batchName (which already has Operasional/Galon prefix when applicable).
            const target = groupLabels[0]
            const matched = Object.values(configs).find(c => format(c.invoiceDate, 'dd-MM-yyyy') === target)
            zipBatchName = matched?.batchName ?? `Kwitansi ${sppg} - ${target}`
        } else if (groupLabels.length > 1) {
            // Date range
            zipBatchName = `Kwitansi ${sppg} - ${groupLabels[0]} sd ${groupLabels[groupLabels.length - 1]}`
        } else {
            // No groupLabels (shouldn't happen in normal flow) — fallback
            zipBatchName = configs[selectedSheetNames[0]]?.batchName
        }

        await downloadAllPDFs(filteredPdfs, zipBatchName)
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
                                    onChange={handleSelectionChange}
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
                                {/* SPPG name — applies to all batch names + customer names */}
                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <Label className="text-sm font-medium">Nama SPPG</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Auto-detect dari nama file. Edit kalau tidak sesuai — batch name &
                                                "Tagihan Kepada" akan ikut otomatis.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-mono text-muted-foreground">SPPG</span>
                                            <Input
                                                value={sppgName}
                                                onChange={(e) => setSppgName(e.target.value)}
                                                className="w-64"
                                                placeholder="Tambak / PGRI Purwojati / ..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Starting kwitansi number — applies across all selected sheets */}
                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <Label className="text-sm font-medium">Nomor Kwitansi Awal</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Hari pertama mulai dari nomor ini — hari berikutnya berurutan otomatis
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-mono text-muted-foreground">#KWITANSI</span>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={startingNumber}
                                                onChange={(e) => {
                                                    const n = parseInt(e.target.value, 10)
                                                    if (!isNaN(n) && n > 0) setStartingNumber(n)
                                                }}
                                                className="w-28 font-mono"
                                                placeholder="916"
                                            />
                                        </div>
                                    </div>
                                </div>

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
                                                                    batchName: defaultBatchName(date, sppgName, previewSheet.category),
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

                                        <div className="space-y-2 pt-2">
                                            <Label>Nomor Kwitansi</Label>
                                            <Input
                                                value={Object.values(previewConfig.invoiceNumbers)[0] || ''}
                                                onChange={(e) => {
                                                    // Apply to ALL suppliers in this sheet — one number per day
                                                    const newNumber = e.target.value
                                                    const newInvoiceNumbers: Record<string, string> = {}
                                                    previewSuppliers.forEach(s => {
                                                        newInvoiceNumbers[s] = newNumber
                                                    })
                                                    updateConfig(previewSheet.sheetName, {
                                                        invoiceNumbers: newInvoiceNumbers,
                                                    })
                                                }}
                                                placeholder="#KWITANSI0916"
                                                className="font-mono"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Berlaku untuk semua supplier di hari ini ({previewSuppliers.length} supplier)
                                            </p>
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
