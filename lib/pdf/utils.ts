import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import path from 'path'

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
 * Format date to full Indonesian format
 * @param date - Date to format
 * @returns Formatted date string (e.g., "20 Januari 2026")
 */
export function formatDateLong(date: Date): string {
    return format(date, 'dd MMMM yyyy', { locale: id })
}

/**
 * Generate invoice number with auto-increment
 * Format: #KWITANSI{XXXX}
 * @param sequence - Sequence number
 * @returns Invoice number (e.g., "#KWITANSI0001")
 */
export function generateInvoiceNumber(sequence: number): string {
    const paddedSequence = sequence.toString().padStart(4, '0')
    return `#KWITANSI${paddedSequence}`
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

/**
 * Reset sequence (for testing)
 */
export function resetSequence(start: number = 1) {
    currentSequence = start
}

/**
 * Dapur Tambak, Sumpiuh, dan Buayan punya 2 varian dokumen yang user pilih
 * sendiri saat generate (bukan lagi berdasarkan tanggal cutoff):
 *   - 'tagihan'  (softfile): judul "TAGIHAN", ttd tetap ada, cap LUNAS hilang.
 *   - 'kwitansi' (hardfile): judul "KWITANSI", ttd & cap LUNAS hilang,
 *     label "Tagihan Kepada" jadi "Pembayaran".
 * Customer lain selalu dapat invoice biasa ("FAKTUR", ttd + cap LUNAS
 * lengkap) — documentType diabaikan untuk mereka.
 */
export type InvoiceDocType = 'tagihan' | 'kwitansi'

const SPECIAL_DAPUR_KEYWORDS = ['TAMBAK', 'SUMPIUH', 'BUAYAN']

export function isSpecialDapur(customerName: string | undefined): boolean {
    if (!customerName) return false
    const upper = customerName.toUpperCase()
    return SPECIAL_DAPUR_KEYWORDS.some(k => upper.includes(k))
}

export function getInvoiceTitle(customerName: string | undefined, docType?: InvoiceDocType): string {
    if (!isSpecialDapur(customerName)) return 'FAKTUR'
    return docType === 'kwitansi' ? 'KWITANSI' : 'TAGIHAN'
}

/** Hides ttd image, garis, nama, dan tanggal di bawahnya — cuma untuk varian KWITANSI. */
export function shouldHideSignature(customerName: string | undefined, docType?: InvoiceDocType): boolean {
    return isSpecialDapur(customerName) && docType === 'kwitansi'
}

/** Cap LUNAS hilang di KEDUA varian (TAGIHAN maupun KWITANSI) dapur-dapur ini. */
export function shouldHideStamp(customerName: string | undefined): boolean {
    return isSpecialDapur(customerName)
}

/** "Tagihan Kepada:" biasa, kecuali varian KWITANSI dapur-dapur ini → "Pembayaran". */
export function getCustomerLabelPrefix(customerName: string | undefined, docType?: InvoiceDocType): string {
    if (isSpecialDapur(customerName) && docType === 'kwitansi') return 'Pembayaran'
    return 'Tagihan Kepada:'
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
