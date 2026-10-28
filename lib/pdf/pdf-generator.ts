import { pdf } from '@react-pdf/renderer'
import type { ParsedExcelData, InvoiceItemForm, GeneratedPDF } from '@/types'
import { getNextInvoiceNumber, getSupplierTemplateKey, InvoiceDocType } from './utils'
import { renderSupplierTemplate } from './templates'

// Render PDF di server (dipanggil dari POST /api/generate-pdf). Helper
// download untuk browser ada di ./download.

export interface PDFGenerationOptions {
    invoiceDate: Date
    batchName?: string
    customerName?: string
    customerNames?: Record<string, string>
    invoiceNumbers?: Record<string, string>
    // Which of the 2 variants to render (see InvoiceDocType in ./doc-variant).
    // undefined = TAGIHAN. Diabaikan untuk invoice lama customer biasa
    // (≤ 11 Okt 2026) — template me-render FAKTUR lama (ttd + cap LUNAS).
    documentType?: InvoiceDocType
}

/**
 * Thrown when a supplier string doesn't match any of the 5 authorized
 * CV/UMKM. Callers must skip that supplier and surface it, not fall back to
 * a default template — an unrecognized name must never quietly become a
 * real invoice for the wrong party.
 */
export class UnrecognizedSupplierError extends Error {
    constructor(public readonly supplier: string) {
        super(`Supplier tidak dikenali (bukan salah satu dari 5 CV/UMKM resmi): ${supplier}`)
        this.name = 'UnrecognizedSupplierError'
    }
}

/**
 * Generate PDF for a specific supplier based on supplier name
 */
async function generatePDFForSupplier(
    supplier: string,
    items: InvoiceItemForm[],
    options: PDFGenerationOptions,
    customInvoiceNumber?: string
): Promise<GeneratedPDF> {
    const invoiceNumber = customInvoiceNumber || getNextInvoiceNumber()
    const { invoiceDate, customerName, customerNames, documentType } = options

    const templateKey = getSupplierTemplateKey(supplier)
    if (!templateKey) {
        throw new UnrecognizedSupplierError(supplier)
    }

    const template = renderSupplierTemplate(templateKey, {
        invoiceNumber,
        invoiceDate,
        items,
        // Use per-supplier customerName if available, otherwise use global customerName
        customerName: customerNames?.[supplier] || customerName,
        documentType,
    })
    const blob = await pdf(template).toBlob()

    return {
        supplier,
        blob,
        invoiceNumber,
        documentType,
    }
}

export interface GenerateInvoicePDFsResult {
    pdfs: GeneratedPDF[]
    // Supplier names found in the parsed data that don't match any of the 5
    // authorized CV/UMKM — no invoice was generated for these, the caller
    // must surface them instead of silently dropping them.
    unrecognizedSuppliers: string[]
}

/**
 * Generate PDFs with custom invoice numbers for each supplier
 */
export async function generateInvoicePDFsWithNumbers(
    parsedData: ParsedExcelData,
    options: PDFGenerationOptions
): Promise<GenerateInvoicePDFsResult> {
    const pdfs: GeneratedPDF[] = []
    const unrecognizedSuppliers: string[] = []
    const { invoiceNumbers = {} } = options

    // Generate PDF for each supplier with custom number
    for (const [supplier, items] of Object.entries(parsedData)) {
        if (items && items.length > 0) {
            try {
                const customNumber = invoiceNumbers[supplier]
                const pdf = await generatePDFForSupplier(supplier, items, options, customNumber)
                pdfs.push(pdf)
            } catch (error) {
                if (error instanceof UnrecognizedSupplierError) {
                    unrecognizedSuppliers.push(supplier)
                    continue
                }
                throw error
            }
        }
    }

    return { pdfs, unrecognizedSuppliers }
}

// Satu baris invoice_items dari DB — field yang dibutuhkan untuk render ulang.
export interface StoredInvoiceItem extends InvoiceItemForm {
    invoice_number: string
    customer_name?: string | null
}

/**
 * Render ulang PDF sebuah invoice dari baris invoice_items (dipakai /history).
 * PDF tidak disimpan di storage: nomor, tanggal, customer, dan item semuanya
 * ada di DB, jadi hasilnya sama dengan saat pertama di-generate (TAGIHAN, atau
 * FAKTUR untuk invoice lama customer biasa).
 */
export async function generateInvoicePDFsFromItems(
    items: StoredInvoiceItem[],
    invoiceDate: Date
): Promise<GenerateInvoicePDFsResult> {
    const parsedData: ParsedExcelData = {}
    const invoiceNumbers: Record<string, string> = {}
    const customerNames: Record<string, string> = {}

    for (const item of items) {
        if (!parsedData[item.supplier]) {
            parsedData[item.supplier] = []
            // Nomor & "Tagihan Kepada" sama untuk semua item satu supplier
            invoiceNumbers[item.supplier] = item.invoice_number || '#0001'
            if (item.customer_name) customerNames[item.supplier] = item.customer_name
        }
        parsedData[item.supplier]!.push({
            supplier: item.supplier,
            item_name: item.item_name,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            total: item.total,
        })
    }

    return generateInvoicePDFsWithNumbers(parsedData, { invoiceDate, invoiceNumbers, customerNames })
}
