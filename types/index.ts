import type { InvoiceDocType } from '@/lib/pdf/doc-variant'

// Database Types
export interface InvoiceHistory {
    id: string
    batch_name: string | null
    invoice_date: string
    total_suppliers: number
    total_items: number
    grand_total: number
    status: 'generated' | 'completed'
    created_at: string
}

export interface InvoiceItem {
    id: string
    history_id: string
    supplier: string // PT JAYAMEN GROUP MANDIRI, UMKM UNDI YUWONO, NUSANTARA FOOD, SUSILO WIDYONO, SRI KARYA MUKTI, UD HIDAYAT
    item_name: string // URAIAN dari Excel
    quantity: number // QTY dari Excel
    unit: string // SATUAN dari Excel
    price: number // HARGA dari Excel
    total: number // TOTAL dari Excel
    is_edited: boolean
    edit_notes: string | null
    created_at: string
}

// Excel Row Type (sesuai struktur Excel yang diberikan)
export interface ExcelRow {
    URAIAN: string
    QTY: number
    HARGA: number
    SATUAN: string
    TOTAL: number
    SUPPLIER: string
}

export interface InvoiceItemForm {
    supplier: string
    item_name: string
    quantity: number
    unit: string
    price: number
    total: number
}

// Parsed Data Types (Group by supplier)
export interface ParsedExcelData {
    'PT JAYAMEN GROUP MANDIRI'?: InvoiceItemForm[]
    'UMKM UNDI YUWONO'?: InvoiceItemForm[]
    'NUSANTARA FOOD'?: InvoiceItemForm[]
    'SUSILO WIDYONO'?: InvoiceItemForm[]
    'SRI KARYA MUKTI'?: InvoiceItemForm[]
    'UD HIDAYAT'?: InvoiceItemForm[]
    [key: string]: InvoiceItemForm[] | undefined
}

// Sheet metadata after parsing a workbook with multiple sheets
export type SheetType = 'single-day' | 'multi-day' | 'unparseable'

// Category detected from sheet name (e.g. "OPS 8 April 2026" → 'operasional').
// Default (no prefix or "(BAHAN BAKU)") → undefined, which means main daily expense.
export type SheetCategory = 'operasional' | 'operasional-galon'

export interface SheetEntry {
    sheetName: string
    type: SheetType
    detectedDate?: string // ISO date string (YYYY-MM-DD) — for single-day
    dateRangeStart?: string // ISO — for multi-day
    dateRangeEnd?: string // ISO — for multi-day
    label: string // human-readable label, e.g. "21 Jan 2026" or "9–13 Nov"
    category?: SheetCategory // OPS / OPS Galon prefix detected from sheet name
    tahap?: number // "TAHAP N" (delivery phase) detected from sheet name, e.g. 2
    data?: ParsedExcelData
    totalItems: number
    grandTotal: number
    error?: string
}

export interface WorkbookParseResult {
    success: boolean
    sheets: SheetEntry[]
    error?: string
}

// PDF hasil render server (POST /api/generate-pdf), dipakai preview & download di browser
export interface GeneratedPDF {
    supplier: string
    blob: Blob
    invoiceNumber: string
    // Optional label identifying which day/batch this PDF belongs to (e.g. "21-01-2026").
    // Used by preview sidebar and ZIP folder grouping when generating across multiple days.
    groupLabel?: string
    // The Nama Batch the user configured for this PDF's day (e.g.
    // "Kwitansi SPPG Tambak - 28/04/2026"). Used as folder name in ZIPs and
    // filename prefix for single-PDF downloads so the user gets neat,
    // consistent file naming that matches what they typed in the UI.
    batchName?: string
    // Which variant this PDF is (TAGIHAN/KWITANSI).
    documentType?: InvoiceDocType
}
