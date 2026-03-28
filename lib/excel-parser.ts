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
// NOTE: /^\d+$/ removed on purpose — it caused valid item rows with only URAIAN+QTY
// (2 cells) to be skipped because the numeric QTY matched the pattern.
const SKIP_PATTERNS = [
    /^(SEMBAKO|BUAH|SAYUR|PROTEIN|DAGING|BUMBU|REMPAH|MINUMAN|SNACK|LAINNYA)/i,
    /^TOTAL\s*$/i,
    /^NO\s*REK/i,
    /^(NO|NOMOR)$/i,
    /^PENGELUARAN/i,
    /^KATEGORI/i,
]

/**
 * Check if a row should be skipped (category, total, etc.)
 */
function shouldSkipRow(row: Record<string, unknown>): boolean {
    const values = Object.values(row)

    const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')

    // Skip rows that have zero meaningful data
    if (nonEmptyValues.length === 0) return true

    // Skip rows where the ONLY non-empty value is a pure number (standalone row numbers like "36")
    if (nonEmptyValues.length === 1) {
        const singleVal = String(nonEmptyValues[0]).trim()
        if (/^\d+$/.test(singleVal)) return true
    }

    // For rows with very few values, check against skip patterns
    if (nonEmptyValues.length <= 2) {
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
 * Parse a cell value to number — supports Indonesian number format.
 * Indonesian: titik (.) = pemisah ribuan, koma (,) = desimal
 * Contoh: "1.280" → 1280, "1.966.500" → 1966500, "1,5" → 1.5
 */
function parseCellToNumber(value: unknown): number {
    // Jika sudah number dari XLSX (raw integer/float murni), langsung kembalikan
    if (typeof value === 'number') {
        // Jika angka bukan integer (e.g. 1.28 bukan 1280), kemungkinan salah parse
        // Tapi kita tidak bisa tahu context-nya dari sini, kembalikan as-is
        return value
    }
    if (value === null || value === undefined || value === '') return 0

    const str = String(value).trim()

    // Hapus prefix Rp
    const cleaned = str.replace(/^Rp\.?\s*/i, '').trim()

    return parseIndonesianNumber(cleaned)
}

/**
 * Parse angka format Indonesia:
 * - Titik (.) sebagai pemisah ribuan: "1.280" → 1280, "1.966.500" → 1966500
 * - Koma (,) sebagai desimal: "1,5" → 1.5
 * - Titik tunggal bisa jadi desimal: "1.5" → 1.5 (tapi "1.280" → 1280)
 */
function parseIndonesianNumber(str: string): number {
    if (!str || str === '') return 0

    const hasDot = str.includes('.')
    const hasComma = str.includes(',')

    if (hasDot && hasComma) {
        // Keduanya ada: format seperti "1.966.500,50" atau "1,966,500.50"
        // Deteksi: jika koma setelah titik terakhir → titik = ribuan, koma = desimal (ID format)
        const lastDot = str.lastIndexOf('.')
        const lastComma = str.lastIndexOf(',')
        if (lastComma > lastDot) {
            // ID format: "1.966.500,50"
            const withoutThousands = str.replace(/\./g, '')
            const withDecimal = withoutThousands.replace(',', '.')
            const n = parseFloat(withDecimal)
            return isNaN(n) ? 0 : n
        } else {
            // US format: "1,966,500.50"
            const withoutThousands = str.replace(/,/g, '')
            const n = parseFloat(withoutThousands)
            return isNaN(n) ? 0 : n
        }
    }

    if (hasDot && !hasComma) {
        // Hanya titik: bisa ribuan ("1.280") atau desimal ("1.5")
        // Jika setelah titik ada tepat 3 digit → ribuan
        // Jika lebih dari satu titik → semua ribuan
        const parts = str.split('.')
        const isThousandSeparator =
            parts.length > 2 || // lebih dari satu titik → pasti ribuan
            (parts.length === 2 && parts[1].length === 3) // satu titik, 3 digit setelahnya → ribuan
        if (isThousandSeparator) {
            const n = parseFloat(str.replace(/\./g, ''))
            return isNaN(n) ? 0 : n
        } else {
            // Decimal: "1.5", "0.75"
            const n = parseFloat(str)
            return isNaN(n) ? 0 : n
        }
    }

    if (!hasDot && hasComma) {
        // Hanya koma: bisa ribuan ("1,280") atau desimal ("1,5")
        const parts = str.split(',')
        const isThousandSeparator =
            parts.length > 2 ||
            (parts.length === 2 && parts[1].length === 3)
        if (isThousandSeparator) {
            const n = parseFloat(str.replace(/,/g, ''))
            return isNaN(n) ? 0 : n
        } else {
            // Decimal: "1,5"
            const n = parseFloat(str.replace(',', '.'))
            return isNaN(n) ? 0 : n
        }
    }

    // Tidak ada titik atau koma — angka murni
    const n = parseFloat(str)
    return isNaN(n) ? 0 : n
}

/**
 * Transform raw row array to ExcelRow object using column mapping
 */
function transformRowToExcelRow(row: unknown[], columnMap: Record<string, number>): Partial<ExcelRow> {
    const qty = columnMap['QTY'] !== undefined ? parseCellToNumber(row[columnMap['QTY']]) : 0
    return {
        URAIAN: columnMap['URAIAN'] !== undefined ? String(row[columnMap['URAIAN']] ?? '').trim() : '',
        QTY: qty,
        HARGA: columnMap['HARGA'] !== undefined ? parseCellToNumber(row[columnMap['HARGA']]) : 0,
        SATUAN: columnMap['SATUAN'] !== undefined ? String(row[columnMap['SATUAN']] ?? '').trim() : '',
        TOTAL: columnMap['TOTAL'] !== undefined ? parseCellToNumber(row[columnMap['TOTAL']]) : 0,
        SUPPLIER: columnMap['SUPPLIER'] !== undefined ? String(row[columnMap['SUPPLIER']] ?? '').trim() : '',
    }
}

/**
 * Check if row has valid data (not empty for required fields)
 * URAIAN dan SUPPLIER wajib ada. QTY harus > 0 (items tanpa qty tidak valid).
 * HARGA boleh 0 (bisa jadi gratis/sudah termasuk).
 */
function isValidDataRow(row: Partial<ExcelRow>): boolean {
    return !!(
        row.URAIAN &&
        row.URAIAN.length > 0 &&
        typeof row.QTY === 'number' &&
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

        // Parse Excel — raw:true agar angka dibaca sebagai number asli XLSX
        // defval:null agar cell kosong jadi null (lebih mudah di-filter)
        const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true, cellText: true })

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Get raw data as 2D array first to find headers
        // raw:false agar XLSX format angka sebagai string (mempertahankan format asli seperti "1.280")
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null })

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

        let lastValidSupplier = '' // Track last valid supplier for inheritance

        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const rawRow = rawRows[i]
            if (!rawRow || rawRow.length === 0) {
                skippedRows++
                continue
            }

            // Create a temporary object to check if should skip (only actual columns, no duplicates)
            const tempObj: Record<string, unknown> = {}
            rawRow.forEach((val, idx) => {
                tempObj[`col${idx}`] = val
            })

            // Check if this is a non-data row (category, total, etc.)
            if (shouldSkipRow(tempObj)) {
                console.log(`[Excel] Row ${i + 1} SKIPPED by shouldSkipRow:`, rawRow)
                skippedRows++
                continue
            }

            // Transform to ExcelRow format using column mapping
            const transformedRow = transformRowToExcelRow(rawRow, columnMap)
            console.log(`[Excel] Row ${i + 1} transformed:`, transformedRow)

            // If SUPPLIER is empty, inherit from the last valid supplier row
            // (common in Excel files where supplier is only filled once per group)
            if (!transformedRow.SUPPLIER || transformedRow.SUPPLIER.length === 0) {
                if (lastValidSupplier) {
                    console.log(`[Excel] Row ${i + 1}: SUPPLIER kosong, inherit dari "${lastValidSupplier}"`)
                    transformedRow.SUPPLIER = lastValidSupplier
                }
            } else {
                lastValidSupplier = transformedRow.SUPPLIER
            }

            // Skip rows that don't have valid data
            if (!isValidDataRow(transformedRow)) {
                console.log(`[Excel] Row ${i + 1} SKIPPED by isValidDataRow:`, {
                    URAIAN: transformedRow.URAIAN,
                    QTY: transformedRow.QTY,
                    SUPPLIER: transformedRow.SUPPLIER,
                    SATUAN: transformedRow.SATUAN,
                })
                skippedRows++
                continue
            }

            try {
                // Validate row against schema
                const validated = excelRowSchema.parse(transformedRow)
                console.log(`[Excel] Row ${i + 1} VALID ✅ → ${transformedRow.URAIAN} (qty: ${transformedRow.QTY}, supplier: ${transformedRow.SUPPLIER})`)
                validRows.push(validated as ExcelRow)
            } catch (error: any) {
                const errors = error.errors?.map((e: any) => e.message) || ['Format data tidak valid']
                console.log(`[Excel] Row ${i + 1} REJECTED by schema ❌:`, { row: transformedRow, errors })
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
