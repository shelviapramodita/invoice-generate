import { z } from 'zod'

/**
 * Helper to parse Rp-formatted string to number
 * Examples: "Rp3.000" -> 3000, "Rp1.966.500" -> 1966500
 */
function parseRupiahToNumber(value: unknown): number {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return NaN

    // Remove "Rp" prefix and thousand separators (.)
    const cleaned = value
        .replace(/^Rp\.?\s*/i, '')
        .replace(/\./g, '')
        .replace(/,/g, '.')
        .trim()

    return parseFloat(cleaned) || 0
}

/**
 * Schema untuk validasi row Excel
 * More flexible to handle various formats
 */
export const excelRowSchema = z.object({
    NO: z.any().optional(), // Ignore NO column
    URAIAN: z.string().min(1, 'URAIAN tidak boleh kosong'),
    QTY: z.preprocess(
        (val) => typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val,
        z.number().positive('QTY harus lebih dari 0')
    ),
    HARGA: z.preprocess(
        parseRupiahToNumber,
        z.number().nonnegative('HARGA tidak boleh negatif')
    ),
    SATUAN: z.string().min(1, 'SATUAN tidak boleh kosong'),
    TOTAL: z.preprocess(
        parseRupiahToNumber,
        z.number().nonnegative('TOTAL tidak boleh negatif')
    ),
    SUPPLIER: z.string().min(1, 'SUPPLIER tidak boleh kosong'),
})

/**
 * Schema untuk validasi batch parsed data
 */
export const parsedDataSchema = z.object({
    items: z.array(excelRowSchema),
    totalItems: z.number(),
    suppliers: z.array(z.string()),
})

/**
 * Schema untuk form upload
 */
export const uploadFormSchema = z.object({
    file: z.instanceof(File, { message: 'File harus berupa File object' }),
    invoiceDate: z.date({ error: 'Tanggal invoice wajib diisi' }),
    batchName: z.string().optional(),
})

/**
 * Validate supplier name apakah valid
 */
export function isValidSupplier(supplierName: string): boolean {
    const validSuppliers = ['CV JAYAMEN', 'UMKM UNDI YUWONO', 'CV SEKAR WIJAYAKUSUMA']
    const normalized = supplierName.trim().toUpperCase()

    return validSuppliers.some(valid =>
        normalized.includes(valid) || valid.includes(normalized)
    )
}

/**
 * Normalize supplier name to standard format
 */
export function normalizeSupplierName(supplierName: string): string {
    const normalized = supplierName.trim().toUpperCase()

    if (normalized.includes('JAYAMEN')) return 'CV JAYAMEN'
    if (normalized.includes('UNDI') || normalized.includes('YUWONO')) return 'UMKM UNDI YUWONO'
    if (normalized.includes('SEKAR') || normalized.includes('WIJAYAKUSUMA')) return 'CV SEKAR WIJAYAKUSUMA'

    return supplierName.trim()
}

