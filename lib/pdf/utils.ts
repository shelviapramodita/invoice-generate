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
 * Dapur Buayan (SPPG Sikayu Buayan) awalnya minta SEMUA invoice tanpa tanda
 * tangan & cap LUNAS, tapi ternyata invoice sebelum tanggal ini masih perlu
 * ttd basah (sudah kadung di-generate/dikirim dengan ttd). Jadi aturannya
 * per-tanggal: sebelum cutoff → tetap ada ttd, mulai cutoff → tanpa ttd.
 * Ubah tanggal ini kalau kebijakannya berubah lagi.
 */
const BUAYAN_NO_SIGNATURE_FROM = '2026-09-12'

export function shouldHideSignature(customerName: string | undefined, invoiceDate: Date): boolean {
    if (!customerName || !customerName.toUpperCase().includes('BUAYAN')) return false
    return format(invoiceDate, 'yyyy-MM-dd') >= BUAYAN_NO_SIGNATURE_FROM
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
export function getSupplierTemplateKey(supplier: string): SupplierTemplateKey | null {
    const key = supplier.toUpperCase()
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
