import { z } from 'zod'

/**
 * Parse angka format Indonesia:
 * - Titik (.) sebagai pemisah ribuan: "1.280" → 1280, "1.966.500" → 1966500
 * - Koma (,) sebagai desimal: "1,5" → 1.5
 * - Heuristic: Multiple separators → thousand sep. Single sep: check digit count (3 digits = thousand).
 */
function parseIndonesianNumber(str: string): number {
    if (!str || str === '') return 0

    const hasDot = str.includes('.')
    const hasComma = str.includes(',')

    if (hasDot && hasComma) {
        const lastDot = str.lastIndexOf('.')
        const lastComma = str.lastIndexOf(',')
        if (lastComma > lastDot) {
            // ID format: "1.966.500,50"
            return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
        } else {
            // US format: "1,966,500.50"
            return parseFloat(str.replace(/,/g, '')) || 0
        }
    }

    if (hasDot && !hasComma) {
        const parts = str.split('.')
        // Multiple dots → pasti thousand separator
        if (parts.length > 2) {
            return parseFloat(str.replace(/\./g, '')) || 0
        }
        // Single dot: check if digit after dot = 3 (thousand sep), otherwise decimal
        if (parts.length === 2 && parts[1].length === 3 && /^\d+$/.test(parts[1])) {
            return parseFloat(str.replace(/\./g, '')) || 0
        }
        return parseFloat(str) || 0
    }

    if (!hasDot && hasComma) {
        const parts = str.split(',')
        // Multiple commas → pasti thousand separator
        if (parts.length > 2) {
            return parseFloat(str.replace(/,/g, '')) || 0
        }
        // Single comma: check if digit after comma = 3 (thousand sep), otherwise decimal
        if (parts.length === 2 && parts[1].length === 3 && /^\d+$/.test(parts[1])) {
            return parseFloat(str.replace(/,/g, '')) || 0
        }
        return parseFloat(str.replace(',', '.')) || 0
    }

    return parseFloat(str) || 0
}

/**
 * Helper to parse Rp-formatted string to number
 * Examples: "Rp3.000" -> 3000, "Rp1.966.500" -> 1966500
 */
function parseRupiahToNumber(value: unknown): number {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return NaN

    const cleaned = value.replace(/^Rp\.?\s*/i, '').trim()
    return parseIndonesianNumber(cleaned)
}

/**
 * Schema untuk validasi row Excel
 * More flexible to handle various formats
 */
export const excelRowSchema = z.object({
    NO: z.any().optional(), // Ignore NO column
    URAIAN: z.string().min(1, 'URAIAN tidak boleh kosong'),
    QTY: z.preprocess(
        (val) => {
            if (typeof val === 'number') return val
            if (typeof val === 'string') {
                return parseIndonesianNumber(val.trim())
            }
            return 0
        },
        z.number().positive('QTY harus lebih dari 0')
    ),
    HARGA: z.preprocess(
        parseRupiahToNumber,
        z.number().nonnegative('HARGA tidak boleh negatif')
    ),
    SATUAN: z.preprocess(
        (val) => (val === null || val === undefined ? '' : String(val).trim()),
        z.string()  // SATUAN boleh kosong
    ),
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
    const validSuppliers = ['UMKM PURWOTO', 'UMKM UNDI YUWONO', 'CV SEKAR WIJAYAKUSUMA', 'SRI KARYA MUKTI', 'UD HIDAYAT']
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

    if (normalized.includes('JAYAMEN') || normalized.includes('PURWOTO')) return 'UMKM PURWOTO'
    if (normalized.includes('UNDI') || normalized.includes('YUWONO')) return 'UMKM UNDI YUWONO'
    if (normalized.includes('SEKAR') || normalized.includes('WIJAYAKUSUMA')) return 'CV SEKAR WIJAYAKUSUMA'
    if (normalized.includes('SRI') || normalized.includes('KARYA MUKTI')) return 'SRI KARYA MUKTI'
    if (normalized.includes('HIDAYAT')) return 'UD HIDAYAT'

    return supplierName.trim()
}

