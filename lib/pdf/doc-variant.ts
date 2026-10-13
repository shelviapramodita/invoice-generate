import { format } from 'date-fns'

/**
 * Aturan varian dokumen — sengaja dipisah dari ./utils (yang import `path`)
 * supaya bisa dipakai juga di client component (app/upload/page.tsx).
 *
 * Dapur Tambak, Sumpiuh, dan Buayan selalu punya 2 varian yang user pilih
 * lewat toggle di preview:
 *   - 'tagihan'  (softfile): judul "TAGIHAN", ttd ada, tanpa cap LUNAS.
 *   - 'kwitansi' (hardfile): judul "KWITANSI", tanpa ttd & cap LUNAS,
 *     label "Tagihan Kepada" jadi "Pembayaran".
 * Customer lain baru ikut skema ini untuk invoice bertanggal mulai
 * ALL_CUSTOMER_VARIANTS_FROM. Sebelum tanggal itu tetap invoice lama
 * ('faktur': judul "FAKTUR", ttd + cap LUNAS, tanpa toggle varian).
 */
export type InvoiceDocType = 'tagihan' | 'kwitansi'

/** Varian yang benar-benar di-render template (termasuk FAKTUR lama). */
export type RenderedDocType = InvoiceDocType | 'faktur'

const SPECIAL_DAPUR_KEYWORDS = ['TAMBAK', 'SUMPIUH', 'BUAYAN']

/** Mulai tanggal ini (inklusif) semua customer pakai TAGIHAN/KWITANSI. */
const ALL_CUSTOMER_VARIANTS_FROM = '2026-10-13'

export function isSpecialDapur(customerName: string | undefined): boolean {
    if (!customerName) return false
    const upper = customerName.toUpperCase()
    return SPECIAL_DAPUR_KEYWORDS.some(k => upper.includes(k))
}

/** true = invoice ini masih pakai template lama (FAKTUR, ttd + cap LUNAS). */
export function usesLegacyFaktur(customerName: string | undefined, invoiceDate: Date): boolean {
    if (isSpecialDapur(customerName)) return false
    return format(invoiceDate, 'yyyy-MM-dd') < ALL_CUSTOMER_VARIANTS_FROM
}

/** documentType undefined (mis. regenerate dari /history) = 'tagihan'. */
export function resolveDocType(
    customerName: string | undefined,
    invoiceDate: Date,
    docType?: InvoiceDocType,
): RenderedDocType {
    if (usesLegacyFaktur(customerName, invoiceDate)) return 'faktur'
    return docType ?? 'tagihan'
}
