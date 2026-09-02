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

export interface RevisionLog {
    id: string
    history_id: string
    revised_at: string
    revised_by: string | null
    changes: any
    reason: string | null
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

// Form Types
export interface ExcelUploadForm {
    file: File
    invoiceDate: Date
    batchName?: string
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

// Invoice Summary per Supplier
export interface InvoiceSummary {
    supplier: string
    items: InvoiceItemForm[]
    subtotal: number
    itemCount: number
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
