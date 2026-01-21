import * as XLSX from 'xlsx'
import { ExcelRow, ParsedExcelData, InvoiceItemForm } from '@/types'
import { excelRowSchema, normalizeSupplierName } from './validators'

interface ParseResult {
    success: boolean
    data?: ParsedExcelData
    error?: string
    invalidRows?: Array<{ row: number; errors: string[] }>
}

/**
 * Normalize column names to expected format
 * Handles various naming conventions in Excel files
 */
function normalizeColumnNames(row: any): any {
    const normalized: any = {}

    // Column name mappings (lowercase key -> standard name)
    const columnMappings: Record<string, string> = {
        // URAIAN variations
        'uraian': 'URAIAN',
        'nama': 'URAIAN',
        'nama barang': 'URAIAN',
        'nama item': 'URAIAN',
        'item': 'URAIAN',
        'description': 'URAIAN',
        'deskripsi': 'URAIAN',
        'barang': 'URAIAN',
        // QTY variations
        'qty': 'QTY',
        'quantity': 'QTY',
        'jumlah': 'QTY',
        'jml': 'QTY',
        'kuantitas': 'QTY',
        // HARGA variations
        'harga': 'HARGA',
        'price': 'HARGA',
        'harga satuan': 'HARGA',
        'unit price': 'HARGA',
        // SATUAN variations
        'satuan': 'SATUAN',
        'unit': 'SATUAN',
        'uom': 'SATUAN',
        // TOTAL variations
        'total': 'TOTAL',
        'jumlah harga': 'TOTAL',
        'amount': 'TOTAL',
        'subtotal': 'TOTAL',
        // SUPPLIER variations
        'supplier': 'SUPPLIER',
        'vendor': 'SUPPLIER',
        'nama supplier': 'SUPPLIER',
        'pemasok': 'SUPPLIER',
        // NO (optional - will be ignored)
        'no': 'NO',
        'no.': 'NO',
        'nomor': 'NO',
        'number': 'NO',
    }

    for (const [key, value] of Object.entries(row)) {
        const normalizedKey = key.toString().trim().toLowerCase()
        const mappedKey = columnMappings[normalizedKey] || key
        normalized[mappedKey] = value
    }

    return normalized
}

/**
 * Parse Excel file dan group by supplier
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()

        // Parse Excel
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Convert to JSON
        const rawData: unknown[] = XLSX.utils.sheet_to_json(worksheet)

        if (rawData.length === 0) {
            return {
                success: false,
                error: 'File Excel kosong atau tidak memiliki data',
            }
        }

        // Log first row column names for debugging
        const firstRow = rawData[0] as any
        console.log('[Parser] Column names found:', Object.keys(firstRow))


        // Validate and transform data
        const validRows: ExcelRow[] = []
        const invalidRows: Array<{ row: number; errors: string[] }> = []

        console.log('[Parser] Raw data rows:', rawData.length)
        console.log('[Parser] First row sample:', JSON.stringify(rawData[0]))

        rawData.forEach((row, index) => {
            // Normalize column names first
            const rowObj = normalizeColumnNames(row)

            // Get URAIAN value for checking
            const uraian = rowObj.URAIAN?.toString().trim().toUpperCase() || ''

            // Skip category header rows (SEMBAKO, BUAH, SAYUR & PROTEIN, etc.)
            const categoryHeaders = [
                'SEMBAKO', 'BUAH', 'SAYUR & PROTEIN', 'SAYUR', 'PROTEIN',
                'SNACK', 'MINUMAN', 'BUMBU', 'LAINNYA', 'REMPAH', 'KERING', 'SEGAR'
            ]
            const isCategoryHeader = categoryHeaders.includes(uraian)

            // Skip TOTAL rows (where URAIAN is exactly "TOTAL")
            const isTotalRow = uraian === 'TOTAL'

            // Skip if category header or total row
            if (isCategoryHeader || isTotalRow) {
                console.log(`[Parser] Skipping row ${index + 2}: "${uraian}" (category/total)`)
                return
            }

            // Skip completely empty rows (no data at all)
            const hasAnyData = Object.values(rowObj).some(v => v !== undefined && v !== null && v !== '')
            if (!hasAnyData) {
                console.log(`[Parser] Skipping row ${index + 2}: empty row`)
                return
            }

            try {
                // Validate normalized row against schema
                const validated = excelRowSchema.parse(rowObj)
                validRows.push(validated as ExcelRow)
                console.log(`[Parser] Valid row ${index + 2}: ${rowObj.URAIAN}`)
            } catch (error: any) {
                const errors = error.errors?.map((e: any) => `${e.path?.join('.')}: ${e.message}`) || ['Invalid data format']
                console.log(`[Parser] Invalid row ${index + 2}:`, errors)
                invalidRows.push({ row: index + 2, errors }) // +2 karena header di row 1
            }
        })

        // If too many invalid rows, return error
        if (invalidRows.length > rawData.length * 0.3) {
            return {
                success: false,
                error: `Terlalu banyak data invalid (${invalidRows.length}/${rawData.length} rows)`,
                invalidRows,
            }
        }

        // Group by supplier
        const groupedData: ParsedExcelData = {}

        validRows.forEach((row) => {
            const supplier = normalizeSupplierName(row.SUPPLIER)

            if (!groupedData[supplier]) {
                groupedData[supplier] = []
            }

            groupedData[supplier]!.push({
                supplier,
                item_name: row.URAIAN,
                quantity: row.QTY,
                unit: row.SATUAN,
                price: row.HARGA,
                total: row.TOTAL,
            })
        })

        return {
            success: true,
            data: groupedData,
            invalidRows: invalidRows.length > 0 ? invalidRows : undefined,
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Gagal mem-parse file Excel',
        }
    }
}

/**
 * Calculate total per supplier
 */
export function calculateSupplierTotal(items: InvoiceItemForm[]): number {
    return items.reduce((sum, item) => sum + item.total, 0)
}

/**
 * Get summary dari parsed data
 */
export function getParsedDataSummary(data: ParsedExcelData) {
    const summary = Object.entries(data).map(([supplier, items]) => ({
        supplier,
        itemCount: items?.length || 0,
        subtotal: calculateSupplierTotal(items || []),
    }))

    const grandTotal = summary.reduce((sum, s) => sum + s.subtotal, 0)

    return {
        suppliers: summary,
        totalItems: summary.reduce((sum, s) => sum + s.itemCount, 0),
        grandTotal,
    }
}
