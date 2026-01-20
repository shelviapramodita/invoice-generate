import * as XLSX from 'xlsx'

interface ExportData {
    'Batch Name': string
    'Tanggal Invoice': string
    'Total Suppliers': number
    'Total Items': number
    'Grand Total': string
    Status: string
    'Created At': string
}

/**
 * Export invoice history to Excel
 */
export function exportHistoryToExcel(
    data: any[],
    filename: string = 'invoice-history.xlsx'
) {
    // Prepare data for export
    const exportData: ExportData[] = data.map((invoice) => ({
        'Batch Name': invoice.batch_name || 'Untitled',
        'Tanggal Invoice': new Date(invoice.invoice_date).toLocaleDateString('id-ID'),
        'Total Suppliers': invoice.total_suppliers,
        'Total Items': invoice.total_items,
        'Grand Total': formatIDR(invoice.grand_total),
        Status: invoice.status,
        'Created At': new Date(invoice.created_at).toLocaleDateString('id-ID'),
    }))

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(exportData)

    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // Batch Name
        { wch: 15 }, // Tanggal Invoice
        { wch: 15 }, // Total Suppliers
        { wch: 12 }, // Total Items
        { wch: 15 }, // Grand Total
        { wch: 12 }, // Status
        { wch: 15 }, // Created At
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice History')

    // Generate Excel file and trigger download
    XLSX.writeFile(wb, filename)
}

/**
 * Export single invoice with detailed items
 */
export function exportInvoiceDetailToExcel(
    invoice: any,
    items: any[],
    filename?: string
) {
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
        ['Batch Name', invoice.batch_name || 'Untitled'],
        ['Tanggal Invoice', new Date(invoice.invoice_date).toLocaleDateString('id-ID')],
        ['Total Suppliers', invoice.total_suppliers],
        ['Total Items', invoice.total_items],
        ['Grand Total', formatIDR(invoice.grand_total)],
        ['Status', invoice.status],
        [],
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

    // Group items by supplier
    const itemsBySupplier: Record<string, any[]> = {}
    items.forEach((item) => {
        if (!itemsBySupplier[item.supplier]) {
            itemsBySupplier[item.supplier] = []
        }
        itemsBySupplier[item.supplier]!.push(item)
    })

    // Create sheet per supplier
    Object.entries(itemsBySupplier).forEach(([supplier, supplierItems]) => {
        const sheetData = supplierItems.map((item, index) => ({
            No: index + 1,
            'Item Name': item.item_name,
            Quantity: item.quantity,
            Unit: item.unit,
            Price: formatIDR(item.price),
            Total: formatIDR(item.total),
        }))

        const ws = XLSX.utils.json_to_sheet(sheetData)

        // Set column widths
        ws['!cols'] = [
            { wch: 5 },  // No
            { wch: 30 }, // Item Name
            { wch: 10 }, // Quantity
            { wch: 8 },  // Unit
            { wch: 15 }, // Price
            { wch: 15 }, // Total
        ]

        // Add subtotal row
        const subtotal = supplierItems.reduce((sum, item) => sum + item.total, 0)
        const lastRow = sheetData.length + 2
        XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', 'Subtotal:', formatIDR(subtotal)]], {
            origin: `A${lastRow}`,
        })

        // Truncate supplier name for sheet name (max 31 chars)
        const sheetName = supplier.substring(0, 28)
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })

    // Generate filename
    const defaultFilename = `Invoice-${invoice.batch_name || 'Untitled'}-${new Date().getTime()}.xlsx`
    XLSX.writeFile(wb, filename || defaultFilename)
}

// Helper function
function formatIDR(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount)
}
