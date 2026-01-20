import { z } from 'zod'

/**
 * Schema untuk validasi row Excel
 */
export const excelRowSchema = z.object({
    URAIAN: z.string().min(1, 'URAIAN tidak boleh kosong'),
    QTY: z.number().positive('QTY harus lebih dari 0'),
    HARGA: z.number().nonnegative('HARGA tidak boleh negatif'),
    SATUAN: z.string().min(1, 'SATUAN tidak boleh kosong'),
    TOTAL: z.number().nonnegative('TOTAL tidak boleh negatif'),
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
