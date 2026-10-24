import { format } from 'date-fns'
import path from 'path'
import type { RenderedDocType } from './doc-variant'

/**
 * Get the absolute path for assets (works in server-side rendering)
 */
export function getAssetPath(relativePath: string): string {
    // For server-side rendering, use absolute file path
    if (typeof window === 'undefined') {
        return path.join(process.cwd(), 'public', relativePath)
    }
    // For client-side, use relative URL
    return relativePath
}

/**
 * Format number to Indonesian Rupiah currency
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "Rp1.800,00")
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
        .format(amount)
        .replace('IDR', 'Rp')
        .trim()
}

/**
 * Format number to currency without symbol for PDF
 * @param amount - Amount to format
 * @returns Formatted number (e.g., "1.800,00")
 */
export function formatNumber(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)
}

/**
 * Format date to DD/MM/YYYY for Indonesian format
 * @param date - Date to format
 * @returns Formatted date string (e.g., "20/01/2026")
 */
export function formatDate(date: Date): string {
    return format(date, 'dd/MM/yyyy')
}

/**
 * Generate invoice number with auto-increment
 * Format: #{XXXX} — general, tanpa prefix "KWITANSI" (dipakai juga untuk
 * varian TAGIHAN/KWITANSI).
 * @param sequence - Sequence number
 * @returns Invoice number (e.g., "#0001", "#1678")
 */
export function generateInvoiceNumber(sequence: number): string {
    const paddedSequence = sequence.toString().padStart(4, '0')
    return `#${paddedSequence}`
}

/**
 * Get current sequence number from database or localStorage
 * For now, we'll use a simple counter
 */
let currentSequence = 1

export function getNextInvoiceNumber(): string {
    const invoiceNumber = generateInvoiceNumber(currentSequence)
    currentSequence++
    return invoiceNumber
}

// Aturan varian (TAGIHAN/KWITANSI vs FAKTUR lama, cutoff tanggal) ada di
// ./doc-variant. Template memanggil resolveDocType() sekali, lalu helper di
// bawah menerima hasilnya.
export type { InvoiceDocType, RenderedDocType } from './doc-variant'
export { resolveDocType } from './doc-variant'

export function getInvoiceTitle(docType: RenderedDocType): string {
    if (docType === 'faktur') return 'FAKTUR'
    return docType === 'kwitansi' ? 'KWITANSI' : 'TAGIHAN'
}

/** Label nomor di header, mengikuti judul dokumen: "No. Faktur" / "No. Tagihan" / "No. Kwitansi". */
export function getInvoiceNumberLabel(docType: RenderedDocType): string {
    const title = getInvoiceTitle(docType)
    return `No. ${title.charAt(0)}${title.slice(1).toLowerCase()}`
}

/** Hides ttd image, garis, nama, dan tanggal di bawahnya — cuma untuk varian KWITANSI. */
export function shouldHideSignature(docType: RenderedDocType): boolean {
    return docType === 'kwitansi'
}

/** Cap LUNAS cuma ada di FAKTUR lama (customer lain, invoice ≤ 11 Okt 2026). */
export function shouldShowStamp(docType: RenderedDocType): boolean {
    return docType === 'faktur'
}

/** "Tagihan Kepada:" biasa, kecuali varian KWITANSI → "Pembayaran". */
export function getCustomerLabelPrefix(docType: RenderedDocType): string {
    return docType === 'kwitansi' ? 'Pembayaran' : 'Tagihan Kepada:'
}

/**
 * The only 5 CV/UMKM this app is authorized to invoice, per
 * "DATA PT DAN UMKM TERBARU" — every other supplier name that shows up in an
 * Excel sheet (typo, unrelated text, a supplier not yet onboarded) must NOT
 * silently turn into an invoice for one of these five. Keep this list and
 * normalizeSupplierName() in lib/validators.ts in sync.
 */
export type SupplierTemplateKey =
    | 'jayamen'
    | 'undi-yuwono'
    | 'nusantara-food'
    | 'susilo-widyono'
    | 'sri-karya-mukti'
    | 'ud-hidayat'

/**
 * Resolve a (possibly raw, any-case) supplier string to one of the 5
 * authorized CV/UMKM templates. Returns null when it doesn't match any of
 * them — callers must treat that as "don't generate an invoice", not fall
 * back to a default template.
 */
/**
 * Sheets sometimes have doubled-letter typos in a supplier name (e.g. "UD
 * HIIDAYAT" instead of "UD HIDAYAT"), which breaks a plain .includes()
 * keyword check since the doubled letter isn't part of the real keyword.
 * Collapse consecutive duplicate letters so these still resolve correctly.
 */
function collapseRepeatedLetters(str: string): string {
    return str.replace(/([A-Z])\1+/g, '$1')
}

export function getSupplierTemplateKey(supplier: string): SupplierTemplateKey | null {
    const key = collapseRepeatedLetters(supplier.toUpperCase())
    if (key.includes('JAYAMEN') || key.includes('PURWOTO')) return 'jayamen'
    // Dicek duluan sebelum UNDI/YUWONO: beberapa sheet nulis nama ini dengan
    // typo "SUSILO YUWONO" (harusnya "SUSILO WIDYONO"), yang kalau dicek
    // "YUWONO" duluan malah nyasar ke template UMKM Undi Yuwono.
    if (key.includes('SUSILO') || key.includes('WIDYONO') || key.includes('WIDIYONO')) return 'susilo-widyono'
    if (key.includes('UNDI') || key.includes('YUWONO')) return 'undi-yuwono'
    if (key.includes('NUSANTARA') || key.includes('SEKAR') || key.includes('WIJAYAKUSUMA')) return 'nusantara-food'
    // "Waris Ika Pujian" = nama pemilik rekening Sri Karya Mukti
    if (key.includes('WARIS') || key.includes('PUJIAN')) return 'sri-karya-mukti'
    if (key.includes('SRI') || key.includes('KARYA MUKTI')) return 'sri-karya-mukti'
    if (key.includes('HIDAYAT')) return 'ud-hidayat'
    return null
}
