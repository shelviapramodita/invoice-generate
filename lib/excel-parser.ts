import * as XLSX from 'xlsx'
import { ExcelRow, ParsedExcelData, InvoiceItemForm, SheetEntry, WorkbookParseResult, SheetType, SheetCategory } from '@/types'
import { excelRowSchema, normalizeSupplierName } from './validators'
import { getSupplierConfig } from '@/data/cv-reference'
import { normalizeItemName } from './text-normalizer'

interface ParseResult {
    success: boolean
    data?: ParsedExcelData
    error?: string
    invalidRows?: Array<{ row: number; errors: string[] }>
    skippedRows?: number
}

// Indonesian month names → 0-indexed month number
const ID_MONTHS: Record<string, number> = {
    JAN: 0, JANUARI: 0,
    FEB: 1, FEBRUARI: 1,
    MAR: 2, MARET: 2,
    APR: 3, APRIL: 3,
    MEI: 4, MAY: 4,
    JUN: 5, JUNI: 5,
    JUL: 6, JULI: 6,
    AGU: 7, AGS: 7, AGUSTUS: 7, AUG: 7,
    SEP: 8, SEPT: 8, SEPTEMBER: 8,
    OKT: 9, OKTOBER: 9, OCT: 9,
    NOV: 10, NOP: 10, NOVEMBER: 10, NOPEMBER: 10,
    DES: 11, DESEMBER: 11, DEC: 11, DESEMBER2: 11,
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function isPlausibleYear(y: number): boolean {
    return y >= 2020 && y <= 2050
}

/**
 * Parse a sheet name to detect date or date-range.
 * Examples handled:
 *   "21 JAN 2026 DONE"      → single-day, 2026-01-21
 *   "1 FEB 2026 done"        → single-day
 *   "8 JAN 2026 (BAHAN BAKU) DONE" → single-day
 *   "9-13 NOV DONE"          → multi-day range, Nov 9–13 (year inferred or undefined)
 *   "30 NOV - 4 DES"         → multi-day spanning months
 *   "Copy of 23-27 NOV"      → multi-day
 *   "2026"                   → unparseable
 */
export function parseSheetName(name: string, fallbackYear?: number): {
    type: SheetType
    detectedDate?: Date
    dateRangeStart?: Date
    dateRangeEnd?: Date
    label: string
    category?: SheetCategory
} {
    // Detect category from sheet name BEFORE stripping. "OPS GALON" must be checked
    // before standalone "OPS" to avoid matching the prefix and leaving "GALON" behind.
    let category: SheetCategory | undefined
    const upperRaw = name.toUpperCase()
    if (/\bOPS\s+GALON\b/.test(upperRaw)) category = 'operasional-galon'
    else if (/\bOPS\b/.test(upperRaw)) category = 'operasional'

    const cleaned = name
        .replace(/\(.*?\)/g, ' ')
        // Strip OPS GALON first, then standalone OPS, plus other noise tokens
        .replace(/\b(OPS\s+GALON|OPS|DONE|done|Done|BAHAN\s*BAKU|Copy\s*of)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()

    const monthAlt = Object.keys(ID_MONTHS).join('|')

    // Pattern: "<D>-<D> <MONTH> <YEAR?>" or "<D> <MONTH> - <D> <MONTH> <YEAR?>"
    // Same-month range: "9-13 NOV 2025"
    const rangeSameMonth = new RegExp(`^(\\d{1,2})\\s*-\\s*(\\d{1,2})\\s+(${monthAlt})(?:\\s+(\\d{2,4}))?`, 'i')
    // Cross-month range: "30 NOV - 4 DES 2025"
    const rangeCrossMonth = new RegExp(`^(\\d{1,2})\\s+(${monthAlt})\\s*-\\s*(\\d{1,2})\\s+(${monthAlt})(?:\\s+(\\d{2,4}))?`, 'i')
    // Single day: "21 JAN 2026" or "21 JAN"
    const single = new RegExp(`^(\\d{1,2})\\s+(${monthAlt})(?:\\s+(\\d{2,4}))?`, 'i')

    let m = cleaned.match(rangeCrossMonth)
    if (m) {
        const d1 = parseInt(m[1], 10)
        const mo1 = ID_MONTHS[m[2].toUpperCase()]
        const d2 = parseInt(m[3], 10)
        const mo2 = ID_MONTHS[m[4].toUpperCase()]
        const yearRaw = m[5] ? parseInt(m[5], 10) : (fallbackYear ?? new Date().getFullYear())
        const year = isPlausibleYear(yearRaw) ? yearRaw : (fallbackYear ?? new Date().getFullYear())
        // If first month > second, the range spans year boundary (Dec → Jan)
        const startYear = mo1 > mo2 ? year - 1 : year
        const start = new Date(Date.UTC(startYear, mo1, d1))
        const end = new Date(Date.UTC(year, mo2, d2))
        return {
            type: 'multi-day',
            dateRangeStart: start,
            dateRangeEnd: end,
            label: `${d1} ${MONTH_LABELS[mo1]} – ${d2} ${MONTH_LABELS[mo2]} ${year}`,
            category,
        }
    }

    m = cleaned.match(rangeSameMonth)
    if (m) {
        const d1 = parseInt(m[1], 10)
        const d2 = parseInt(m[2], 10)
        const mo = ID_MONTHS[m[3].toUpperCase()]
        const yearRaw = m[4] ? parseInt(m[4], 10) : (fallbackYear ?? new Date().getFullYear())
        const year = isPlausibleYear(yearRaw) ? yearRaw : (fallbackYear ?? new Date().getFullYear())
        const start = new Date(Date.UTC(year, mo, d1))
        const end = new Date(Date.UTC(year, mo, d2))
        return {
            type: 'multi-day',
            dateRangeStart: start,
            dateRangeEnd: end,
            label: `${d1}–${d2} ${MONTH_LABELS[mo]} ${year}`,
            category,
        }
    }

    m = cleaned.match(single)
    if (m) {
        const d = parseInt(m[1], 10)
        const mo = ID_MONTHS[m[2].toUpperCase()]
        const yearRaw = m[3] ? parseInt(m[3], 10) : (fallbackYear ?? new Date().getFullYear())
        const year = isPlausibleYear(yearRaw) ? yearRaw : (fallbackYear ?? new Date().getFullYear())
        const date = new Date(Date.UTC(year, mo, d))
        return {
            type: 'single-day',
            detectedDate: date,
            label: `${d} ${MONTH_LABELS[mo]} ${year}`,
            category,
        }
    }

    return { type: 'unparseable', label: name.trim() || '(no name)', category }
}

// Required columns for invoice data
const REQUIRED_COLUMNS = ['URAIAN', 'QTY', 'HARGA', 'SATUAN', 'TOTAL', 'SUPPLIER']

// Patterns to detect non-data rows (categories, totals, notes)
const SKIP_PATTERNS = [
    /^(SEMBAKO|BUAH|SAYUR|PROTEIN|DAGING|BUMBU|REMPAH|MINUMAN|SNACK|LAINNYA|SAYUR\s*&\s*PROTEIN)/i,
    /^TOTAL\s*$/i,
    /^(NO|NOMOR)$/i,
    /^PENGELUARAN/i,
    /^KATEGORI/i,
    /^\d+$/,  // Just a number (row numbers)
]

// Pattern to extract supplier from "NO REK" lines
// Captures: (1) account number, (2) bank name
const SUPPLIER_PATTERN = /NO\s*REK\.\s*(\d+)\s*(.+?)(?:\s*-\s*)?$/i

// Supplier names yang sengaja diabaikan — bukan CV/UMKM asli yang perlu di-invoice-kan
// (mis. KDMP adalah kelompok/program internal SPPG, bukan supplier eksternal)
const IGNORED_SUPPLIERS = ['KDMP']

function isIgnoredSupplier(supplierName: string | undefined): boolean {
    if (!supplierName) return false
    const upper = supplierName.toUpperCase()
    return IGNORED_SUPPLIERS.some(name => upper.includes(name))
}

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

    // Skip "NO REK" rows (they contain supplier info, handled separately)
    const stringValues = values.map(v => String(v || '').trim())
    if (stringValues.some(v => /NO\s*REK\./i.test(v))) {
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

function parseCellToNumber(value: unknown): number {
    if (typeof value === 'number') return value
    if (value === null || value === undefined || value === '') return 0

    const str = String(value).trim()

    // Hapus prefix Rp
    const cleaned = str.replace(/^Rp\.?\s*/i, '').trim()

    const result = parseIndonesianNumber(cleaned)
    return result
}

/**
 * Parse angka format Indonesia:
 * - Titik (.) sebagai pemisah ribuan: "1.280" → 1280, "1.966.500" → 1966500
 * - Koma (,) sebagai desimal: "1,5" → 1.5
 * - Heuristic: Jika ada multiple thousand separators (e.g., "1.966.500"), pasti ribuan.
 *   Jika hanya satu separator: gunakan konteks digit count untuk determin apakah ribuan atau desimal.
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
        const parts = str.split('.')
        
        // Multiple dots → pasti thousand separator (e.g., "1.234.567")
        if (parts.length > 2) {
            const n = parseFloat(str.replace(/\./g, ''))
            return isNaN(n) ? 0 : n
        }
        
        // Single dot case: "1.280" atau "1.5"
        // Heuristic: jika digit setelah titik = 3 DAN semua digit, → thousand separator
        if (parts.length === 2) {
            const afterDot = parts[1]
            // Cek: panjang tepat 3 DAN semuanya digit → kemungkinan besar ribuan
            if (afterDot.length === 3 && /^\d+$/.test(afterDot)) {
                const n = parseFloat(str.replace(/\./g, ''))
                return isNaN(n) ? 0 : n
            }
        }
        
        // Fallback: treat as decimal
        const n = parseFloat(str)
        return isNaN(n) ? 0 : n
    }

    if (!hasDot && hasComma) {
        // Hanya koma: bisa ribuan ("1,280") atau desimal ("1,5")
        const parts = str.split(',')
        
        // Multiple commas → pasti thousand separator
        if (parts.length > 2) {
            const n = parseFloat(str.replace(/,/g, ''))
            return isNaN(n) ? 0 : n
        }
        
        // Single comma case: "1,280" atau "1,5"
        if (parts.length === 2) {
            const afterComma = parts[1]
            // Jika digit setelah koma = 3 → thousand separator, otherwise decimal
            if (afterComma.length === 3 && /^\d+$/.test(afterComma)) {
                const n = parseFloat(str.replace(/,/g, ''))
                return isNaN(n) ? 0 : n
            } else {
                // Decimal: "1,5"
                const n = parseFloat(str.replace(',', '.'))
                return isNaN(n) ? 0 : n
            }
        }
        
        return parseFloat(str.replace(',', '.')) || 0
    }

    // Tidak ada titik atau koma — angka murni
    const n = parseFloat(str)
    return isNaN(n) ? 0 : n
}

/**
 * Transform raw row array to ExcelRow object using column mapping
 */
function transformRowToExcelRow(row: unknown[], columnMap: Record<string, number>): Partial<ExcelRow> {
    const qtyRaw = row[columnMap['QTY']]
    const qty = columnMap['QTY'] !== undefined ? parseCellToNumber(qtyRaw) : 0
    
    const uraian = columnMap['URAIAN'] !== undefined ? String(row[columnMap['URAIAN']] ?? '').trim() : ''
    
    return {
        URAIAN: uraian,
        QTY: qty,
        HARGA: columnMap['HARGA'] !== undefined ? parseCellToNumber(row[columnMap['HARGA']]) : 0,
        SATUAN: columnMap['SATUAN'] !== undefined ? String(row[columnMap['SATUAN']] ?? '').trim() : '',
        TOTAL: columnMap['TOTAL'] !== undefined ? parseCellToNumber(row[columnMap['TOTAL']]) : 0,
        SUPPLIER: columnMap['SUPPLIER'] !== undefined ? String(row[columnMap['SUPPLIER']] ?? '').trim() : '',
    }
}

/**
 * Check if row has valid data (not empty for required fields)
 * URAIAN dan QTY wajib ada. QTY harus > 0 (items tanpa qty tidak valid).
 * SUPPLIER boleh kosong (akan di-assign dari last supplier context).
 * HARGA boleh 0 (bisa jadi gratis/sudah termasuk).
 */
function isValidDataRow(row: Partial<ExcelRow>): boolean {
    return !!(
        row.URAIAN &&
        row.URAIAN.length > 0 &&
        typeof row.QTY === 'number' &&
        row.QTY > 0
    )
}

/**
 * Parse pre-loaded raw rows from a single worksheet into ParsedExcelData.
 * Extracted from parseExcelFile so it can be reused per-sheet by parseExcelWorkbook.
 */
function parseWorksheetRows(rawRows: unknown[][]): ParseResult {
    try {
        if (rawRows.length === 0) {
            return {
                success: false,
                error: 'Sheet kosong atau tidak memiliki data',
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

        // First pass: Find all NO REK supplier lines and their positions
        const supplierLines: Array<{ rowIndex: number; supplier: string }> = []
        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const rawRow = rawRows[i]
            if (!rawRow) continue

            const stringValues = rawRow.map(v => String(v || '').trim())
            const noRekValue = stringValues.find(v => /NO\s*REK\./i.test(v))
            if (noRekValue) {
                const match = noRekValue.match(SUPPLIER_PATTERN)
                if (match) {
                    const accountNumber = match[1].trim()
                    const bankName = match[2].trim()
                    const accountAndBank = `${accountNumber} ${bankName}`
                    
                    // Try to find CV name from config using account number
                    const config = getSupplierConfig(accountAndBank)
                    const supplierName = config?.name || accountAndBank
                    
                    if (supplierName) {
                        supplierLines.push({ rowIndex: i, supplier: supplierName })
                    }
                }
            }
        }

        // Function to find supplier for a given row (look-ahead to next NO REK)
        function findSupplierForRow(rowIndex: number): string {
            // Find the first NO REK line at or after this row
            for (const { rowIndex: noRekRow, supplier } of supplierLines) {
                if (noRekRow >= rowIndex) {
                    return supplier
                }
            }
            return ''
        }

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

            // Create a temporary object to check if should skip (only actual columns, no duplicates)
            const tempObj: Record<string, unknown> = {}
            rawRow.forEach((val, idx) => {
                tempObj[`col${idx}`] = val
            })

            // Check for "NO REK" line - skip it
            const stringValues = rawRow.map(v => String(v || '').trim())
            const noRekValue = stringValues.find(v => /NO\s*REK\./i.test(v))
            if (noRekValue) {
                skippedRows++
                continue
            }

            // Check if this is a non-data row (category, total, etc.)
            if (shouldSkipRow(tempObj)) {
                skippedRows++
                continue
            }

            // Transform to ExcelRow format using column mapping
            const transformedRow = transformRowToExcelRow(rawRow, columnMap)

            // If SUPPLIER is empty in the row, look ahead to find the next NO REK supplier
            if (!transformedRow.SUPPLIER || transformedRow.SUPPLIER.length === 0) {
                const lookaheadSupplier = findSupplierForRow(i)
                if (lookaheadSupplier) {
                    transformedRow.SUPPLIER = lookaheadSupplier
                }
            }

            // Abaikan baris dengan supplier yang memang sengaja gak di-invoice-kan (mis. KDMP)
            if (isIgnoredSupplier(transformedRow.SUPPLIER)) {
                skippedRows++
                continue
            }

            // Skip rows that don't have valid data
            if (!isValidDataRow(transformedRow)) {
                skippedRows++
                continue
            }

            // If still no supplier, reject
            if (!transformedRow.SUPPLIER || transformedRow.SUPPLIER.length === 0) {
                invalidRows.push({ row: i + 1, errors: ['Supplier tidak ditemukan. Pastikan ada baris "NO REK" di file Excel.'] })
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
                // Normalize URAIAN here so preview, PDF, and DB all see consistent
                // formatting (Title Case, "non" → "tidak", expanded units, etc.)
                item_name: normalizeItemName(row.URAIAN),
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
 * Parse Excel file (first sheet only). Backward-compat wrapper.
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
    try {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: undefined })
        return parseWorksheetRows(rawRows)
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Gagal mem-parse file Excel',
        }
    }
}

/**
 * Parse the entire workbook: every sheet is attempted, with metadata about
 * detected date(s) from the sheet name. Sheets that fail to parse are still
 * returned with an `error` field so the UI can show why.
 */
export async function parseExcelWorkbook(file: File): Promise<WorkbookParseResult> {
    try {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true })

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return { success: false, sheets: [], error: 'File tidak memiliki sheet' }
        }

        // Determine fallback year: median plausible year from any single-day sheet
        const detectedYears: number[] = []
        for (const name of workbook.SheetNames) {
            const meta = parseSheetName(name)
            if (meta.detectedDate) detectedYears.push(meta.detectedDate.getUTCFullYear())
            if (meta.dateRangeEnd) detectedYears.push(meta.dateRangeEnd.getUTCFullYear())
        }
        const fallbackYear = detectedYears.length > 0
            ? detectedYears.sort((a, b) => a - b)[Math.floor(detectedYears.length / 2)]
            : new Date().getFullYear()

        const sheets: SheetEntry[] = workbook.SheetNames.map(sheetName => {
            const meta = parseSheetName(sheetName, fallbackYear)
            const ws = workbook.Sheets[sheetName]

            if (!ws || !ws['!ref']) {
                return {
                    sheetName,
                    type: meta.type,
                    detectedDate: meta.detectedDate?.toISOString().split('T')[0],
                    dateRangeStart: meta.dateRangeStart?.toISOString().split('T')[0],
                    dateRangeEnd: meta.dateRangeEnd?.toISOString().split('T')[0],
                    label: meta.label,
                    category: meta.category,
                    totalItems: 0,
                    grandTotal: 0,
                    error: 'Sheet kosong',
                }
            }

            const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
                header: 1,
                raw: true,
                defval: undefined,
            })

            const result = parseWorksheetRows(rawRows)

            if (!result.success || !result.data) {
                return {
                    sheetName,
                    type: meta.type,
                    detectedDate: meta.detectedDate?.toISOString().split('T')[0],
                    dateRangeStart: meta.dateRangeStart?.toISOString().split('T')[0],
                    dateRangeEnd: meta.dateRangeEnd?.toISOString().split('T')[0],
                    label: meta.label,
                    category: meta.category,
                    totalItems: 0,
                    grandTotal: 0,
                    error: result.error,
                }
            }

            const summary = getParsedDataSummary(result.data)

            return {
                sheetName,
                type: meta.type,
                detectedDate: meta.detectedDate?.toISOString().split('T')[0],
                dateRangeStart: meta.dateRangeStart?.toISOString().split('T')[0],
                dateRangeEnd: meta.dateRangeEnd?.toISOString().split('T')[0],
                label: meta.label,
                category: meta.category,
                data: result.data,
                totalItems: summary.totalItems,
                grandTotal: summary.grandTotal,
            }
        })

        return { success: true, sheets }
    } catch (error: any) {
        return {
            success: false,
            sheets: [],
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
