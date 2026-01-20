import { NextRequest, NextResponse } from 'next/server'
import { parseExcelFile, getParsedDataSummary } from '@/lib/excel-parser'
import { generateInvoicePDFs } from '@/lib/pdf/pdf-generator'
import { uploadExcelFile, uploadPDFFile } from '@/lib/storage/file-upload'
import { createInvoiceHistory, createInvoiceItems } from '@/lib/db/queries'
import { InvoiceItemForm } from '@/types'

export async function POST(request: NextRequest) {
    try {
        // Parse form data
        const formData = await request.formData()
        const excelFile = formData.get('excelFile') as File | null
        const invoiceDateStr = formData.get('invoiceDate') as string | null
        const batchName = formData.get('batchName') as string | null

        // Validation
        if (!excelFile) {
            return NextResponse.json(
                { error: 'Excel file is required' },
                { status: 400 }
            )
        }

        if (!invoiceDateStr) {
            return NextResponse.json(
                { error: 'Invoice date is required' },
                { status: 400 }
            )
        }

        const invoiceDate = new Date(invoiceDateStr)

        // Step 1: Parse Excel
        console.log('[API] Step 1: Parsing Excel file...')
        const parseResult = await parseExcelFile(excelFile)

        if (!parseResult.success || !parseResult.data) {
            return NextResponse.json(
                { error: parseResult.error || 'Failed to parse Excel file' },
                { status: 400 }
            )
        }

        const parsedData = parseResult.data
        const summary = getParsedDataSummary(parsedData)

        // Step 2: Upload Excel file to storage
        console.log('[API] Step 2: Uploading Excel file...')
        const excelPath = await uploadExcelFile(excelFile, excelFile.name)

        // Step 3: Generate PDFs
        console.log('[API] Step 3: Generating PDFs...')
        const pdfs = await generateInvoicePDFs(parsedData, {
            invoiceDate,
            batchName: batchName || undefined,
        })

        // Step 4: Upload PDFs to storage
        console.log('[API] Step 4: Uploading PDFs...')
        const uploadedPDFs = await Promise.all(
            pdfs.map(async (pdf) => {
                const filename = batchName
                    ? `${batchName}-${pdf.supplier}-${pdf.invoiceNumber}.pdf`
                    : `Invoice-${pdf.supplier}-${pdf.invoiceNumber}.pdf`

                const path = await uploadPDFFile(pdf.blob, filename)
                return {
                    ...pdf,
                    pdfPath: path,
                }
            })
        )

        // Step 5: Save to database
        console.log('[API] Step 5: Saving to database...')

        // Create invoice history
        const invoiceHistory = await createInvoiceHistory({
            batch_name: batchName || undefined,
            invoice_date: invoiceDate,
            excel_file_path: excelPath,
            total_suppliers: summary.suppliers.length,
            total_items: summary.totalItems,
            grand_total: summary.grandTotal,
            status: 'generated',
        })

        // Prepare invoice items with PDF paths
        const allItems: Array<
            InvoiceItemForm & {
                supplier: string
                invoice_number: string
                pdf_file_path: string
            }
        > = []

        uploadedPDFs.forEach((pdf) => {
            const supplierItems = parsedData[pdf.supplier] || []
            supplierItems.forEach((item) => {
                allItems.push({
                    ...item,
                    supplier: pdf.supplier,
                    invoice_number: pdf.invoiceNumber,
                    pdf_file_path: pdf.pdfPath,
                })
            })
        })

        // Create invoice items
        await createInvoiceItems(invoiceHistory.id, allItems)

        console.log('[API] ✅ Success! Invoice generated and saved.')

        // Return success with download URLs
        return NextResponse.json({
            success: true,
            message: `Successfully generated ${pdfs.length} invoices`,
            data: {
                historyId: invoiceHistory.id,
                suppliers: summary.suppliers,
                totalItems: summary.totalItems,
                grandTotal: summary.grandTotal,
                pdfs: uploadedPDFs.map((pdf) => ({
                    supplier: pdf.supplier,
                    invoiceNumber: pdf.invoiceNumber,
                    pdfPath: pdf.pdfPath,
                })),
            },
        })
    } catch (error: any) {
        console.error('[API] Error generating invoices:', error)
        return NextResponse.json(
            {
                error: 'Failed to generate invoices',
                message: error.message || 'Unknown error',
            },
            { status: 500 }
        )
    }
}
