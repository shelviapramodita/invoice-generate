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
    supplier: string // CV JAYAMEN, UMKM UNDI YUWONO, CV SEKAR WIJAYAKUSUMA
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
    'CV JAYAMEN'?: InvoiceItemForm[]
    'UMKM UNDI YUWONO'?: InvoiceItemForm[]
    'CV SEKAR WIJAYAKUSUMA'?: InvoiceItemForm[]
    [key: string]: InvoiceItemForm[] | undefined
}

// Invoice Summary per Supplier
export interface InvoiceSummary {
    supplier: string
    items: InvoiceItemForm[]
    subtotal: number
    itemCount: number
}
