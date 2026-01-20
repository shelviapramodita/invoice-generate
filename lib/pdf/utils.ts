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
