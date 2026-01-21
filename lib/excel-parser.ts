import * as XLSX from 'xlsx'
import { ExcelRow, ParsedExcelData, InvoiceItemForm } from '@/types'
import { excelRowSchema, normalizeSupplierName } from './validators'

interface ParseResult {
    success: boolean
    data?: ParsedExcelData
    error?: string
    invalidRows?: Array<{ row: number; errors: string[] }>
    skippedRows?: number
}

// Required columns for invoice data
const REQUIRED_COLUMNS = ['URAIAN', 'QTY', 'HARGA', 'SATUAN', 'TOTAL', 'SUPPLIER']

// Patterns to detect non-data rows (categories, totals, notes)
const SKIP_PATTERNS = [
    /^(SEMBAKO|BUAH|SAYUR|PROTEIN|DAGING|BUMBU|REMPAH|MINUMAN|SNACK|LAINNYA)/i,
    /^TOTAL\s*$/i,
    /^NO\s*REK/i,
    /^(NO|NOMOR)$/i,
    /^PENGELUARAN/i,
    /^KATEGORI/i,
    /^\d+$/,  // Just a number (row numbers)
]

/**
 * Check if a row should be skipped (category, total, etc.)
 */
function shouldSkipRow(row: Record<string, unknown>): boolean {
    const values = Object.values(row)
    
    // Skip if only 1-2 values (likely category or total row)
    const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')
    if (nonEmptyValues.length <= 2) {
        // Check if any value matches skip patterns
        for (const val of nonEmptyValues) {
            const strVal = String(val).trim()
            if (SKIP_PATTERNS.some(pattern => pattern.test(strVal))) {
                return true
            }
        }
    }
    
    // Skip rows that look like headers within data
    const firstVal = String(values[0] || '').trim().toUpperCase()
    if (['NO', 'NOMOR', 'URAIAN', 'NAMA BARANG'].includes(firstVal)) {
        return true
    }
    
    return false
}

/**
 * Find the header row and create column mapping
 */
function findHeaderAndCreateMapping(rawRows: unknown[][]): { headerRowIndex: number; columnMap: Record<string, number> } | null {
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const row = rawRows[i]
        if (!row) continue
        
        const columnMap: Record<string, number> = {}
        let foundColumns = 0
        
        row.forEach((cell, colIndex) => {
            const cellStr = String(cell || '').trim().toUpperCase()
            
            // Match column names (with variations)
            if (cellStr === 'URAIAN' || cellStr === 'NAMA BARANG' || cellStr === 'NAMA' || cellStr === 'ITEM') {
                columnMap['URAIAN'] = colIndex
                foundColumns++
            } else if (cellStr === 'QTY' || cellStr === 'QUANTITY' || cellStr === 'JUMLAH') {
                columnMap['QTY'] = colIndex
                foundColumns++
            } else if (cellStr === 'HARGA' || cellStr === 'HARGA SATUAN' || cellStr === 'PRICE') {
                columnMap['HARGA'] = colIndex
                foundColumns++
            } else if (cellStr === 'SATUAN' || cellStr === 'UNIT') {
                columnMap['SATUAN'] = colIndex
                foundColumns++
            } else if (cellStr === 'TOTAL' || cellStr === 'JUMLAH HARGA' || cellStr === 'SUBTOTAL') {
                columnMap['TOTAL'] = colIndex
                foundColumns++
            } else if (cellStr === 'SUPPLIER' || cellStr === 'VENDOR' || cellStr === 'PEMASOK') {
                columnMap['SUPPLIER'] = colIndex
                foundColumns++
            }
        })
        
        // Found header if we have at least 4 required columns
        if (foundColumns >= 4) {
            return { headerRowIndex: i, columnMap }
        }
    }
    
    return null
}

/**
 * Transform raw row array to ExcelRow object using column mapping
 */
function transformRowToExcelRow(row: unknown[], columnMap: Record<string, number>): Partial<ExcelRow> {
    return {
        URAIAN: columnMap['URAIAN'] !== undefined ? String(row[columnMap['URAIAN']] || '').trim() : '',
        QTY: columnMap['QTY'] !== undefined ? Number(row[columnMap['QTY']]) || 0 : 0,
        HARGA: columnMap['HARGA'] !== undefined ? Number(row[columnMap['HARGA']]) || 0 : 0,
        SATUAN: columnMap['SATUAN'] !== undefined ? String(row[columnMap['SATUAN']] || '').trim() : '',
        TOTAL: columnMap['TOTAL'] !== undefined ? Number(row[columnMap['TOTAL']]) || 0 : 0,
        SUPPLIER: columnMap['SUPPLIER'] !== undefined ? String(row[columnMap['SUPPLIER']] || '').trim() : '',
    }
}

/**
 * Check if row has valid data (not empty for required fields)
 */
function isValidDataRow(row: Partial<ExcelRow>): boolean {
    return !!(
        row.URAIAN && 
        row.URAIAN.length > 0 &&
        row.QTY && 
        row.QTY > 0 &&
        row.SUPPLIER && 
        row.SUPPLIER.length > 0
    )
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

        // Get raw data as 2D array first to find headers
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (rawRows.length === 0) {
            return {
                success: false,
                error: 'File Excel kosong atau tidak memiliki data',
            }
        }

        // Find header row and create column mapping
        const headerResult = findHeaderAndCreateMapping(rawRows)
        
        if (!headerResult) {
            return {
                success: false,
                error: 'Tidak dapat menemukan header kolom yang valid. Pastikan file memiliki kolom: URAIAN, QTY, HARGA, SATUAN, TOTAL, SUPPLIER',
            }
        }

        const { headerRowIndex, columnMap } = headerResult
        
        // Process data rows (after header)
        const validRows: ExcelRow[] = []
        const invalidRows: Array<{ row: number; errors: string[] }> = []
        let skippedRows = 0

        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const rawRow = rawRows[i]
            if (!rawRow || rawRow.length === 0) {
                skippedRows++
                continue
            }

            // Create a temporary object to check if should skip
            const tempObj: Record<string, unknown> = {}
            rawRow.forEach((val, idx) => {
                tempObj[`col${idx}`] = val
            })
            
            // Also add first column value for pattern checking
            const firstCellValue = rawRow[0]
            if (firstCellValue !== undefined && firstCellValue !== null) {
                tempObj['__first'] = firstCellValue
            }
            
            // Check if this is a non-data row (category, total, etc.)
            if (shouldSkipRow(tempObj)) {
                skippedRows++
                continue
            }

            // Transform to ExcelRow format using column mapping
            const transformedRow = transformRowToExcelRow(rawRow, columnMap)
            
            // Skip rows that don't have valid data
            if (!isValidDataRow(transformedRow)) {
                skippedRows++
                continue
            }

            try {
                // Validate row against schema
                const validated = excelRowSchema.parse(transformedRow)
                validRows.push(validated as ExcelRow)
            } catch (error: any) {
                const errors = error.errors?.map((e: any) => e.message) || ['Format data tidak valid']
                invalidRows.push({ row: i + 1, errors }) // +1 for 1-indexed Excel row
            }
        }

        // Check if we have any valid data
        if (validRows.length === 0) {
            return {
                success: false,
                error: 'Tidak ada data valid yang ditemukan. Pastikan data memiliki kolom yang sesuai.',
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
            skippedRows: skippedRows > 0 ? skippedRows : undefined,
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
