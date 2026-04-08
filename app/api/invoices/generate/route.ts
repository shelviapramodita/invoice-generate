import { NextRequest, NextResponse } from 'next/server'
import { parseExcelFile, getParsedDataSummary } from '@/lib/excel-parser'
import { generateInvoicePDFs } from '@/lib/pdf/pdf-generator'
import { uploadExcelFile, uploadPDFFile } from '@/lib/storage/file-upload'
import { createInvoiceHistory, createInvoiceItems } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'
import { InvoiceItemForm } from '@/types'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const excelFile = formData.get('excelFile') as File | null
        const invoiceDateStr = formData.get('invoiceDate') as string | null
        const batchName = formData.get('batchName') as string | null

        if (!excelFile) {
            return NextResponse.json({ error: 'Excel file is required' }, { status: 400 })
        }

        if (!invoiceDateStr) {
            return NextResponse.json({ error: 'Invoice date is required' }, { status: 400 })
        }

        const invoiceDate = new Date(invoiceDateStr)

        const parseResult = await parseExcelFile(excelFile)
        if (!parseResult.success || !parseResult.data) {
            return NextResponse.json(
                { error: parseResult.error || 'Failed to parse Excel file' },
                { status: 400 }
            )
        }

        const parsedData = parseResult.data
        const summary = getParsedDataSummary(parsedData)

        const excelPath = await uploadExcelFile(excelFile, excelFile.name)

        const pdfs = await generateInvoicePDFs(parsedData, {
            invoiceDate,
            batchName: batchName || undefined,
        })

        const uploadedPDFs = await Promise.all(
            pdfs.map(async (pdf) => {
                const filename = batchName
                    ? `${batchName}-${pdf.supplier}-${pdf.invoiceNumber}.pdf`
                    : `Invoice-${pdf.supplier}-${pdf.invoiceNumber}.pdf`

                const path = await uploadPDFFile(pdf.blob, filename)
                return { ...pdf, pdfPath: path }
            })
        )

        const invoiceHistory = await createInvoiceHistory({
            batch_name: batchName || undefined,
            invoice_date: invoiceDate,
            total_suppliers: summary.suppliers.length,
            total_items: summary.totalItems,
            grand_total: summary.grandTotal,
            status: 'generated',
            user_id: user.id,
        })

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

        await createInvoiceItems(invoiceHistory.id, allItems)

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
        console.error('Error generating invoices:', error)
        return NextResponse.json(
            { error: 'Failed to generate invoices' },
            { status: 500 }
        )
    }
}
