import { NextRequest, NextResponse } from 'next/server'
import { generateInvoicePDFsWithNumbers, GeneratedPDF } from '@/lib/pdf/pdf-generator'
import { ParsedExcelData, InvoiceItemForm } from '@/types'
import { createInvoiceHistory, createInvoiceItems } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { parsedData, invoiceDate, batchName, invoiceNumbers } = body

        if (!parsedData) {
            return NextResponse.json(
                { error: 'Missing parsed data' },
                { status: 400 }
            )
        }

        // Generate PDFs
        const pdfs = await generateInvoicePDFsWithNumbers(parsedData as ParsedExcelData, {
            invoiceDate: new Date(invoiceDate),
            batchName,
            invoiceNumbers,
        })

        // Calculate summary for database
        const suppliers = Object.keys(parsedData)
        let totalItems = 0
        let grandTotal = 0

        Object.values(parsedData as ParsedExcelData).forEach((items) => {
            if (!items) return
            totalItems += items.length
            items.forEach((item) => {
                grandTotal += item.total
            })
        })

        // Save to database
        console.log('[API] Saving invoice to database...')
        const invoiceHistory = await createInvoiceHistory({
            batch_name: batchName || undefined,
            invoice_date: new Date(invoiceDate),
            total_suppliers: suppliers.length,
            total_items: totalItems,
            grand_total: grandTotal,
            status: 'generated',
        })

        // Initialize Supabase client
        const supabase = await createClient()

        // Prepare invoice items with supplier and invoice number
        const allItems: Array<
            InvoiceItemForm & {
                supplier: string
                invoice_number: string
                pdf_file_path: string
            }
        > = []

        // Upload PDFs and prepare items
        for (const pdf of pdfs) {
            // Upload to Supabase Storage
            // Sanitize filename to avoid issues with special characters or slashes
            const safeSupplier = pdf.supplier.replace(/[^a-zA-Z0-9.-]/g, '-')
            const safeInvoiceNumber = pdf.invoiceNumber.replace(/[^a-zA-Z0-9.-]/g, '-')
            const filename = `${Date.now()}-${safeSupplier}-${safeInvoiceNumber}.pdf`

            // Convert Blob to ArrayBuffer for upload
            const arrayBuffer = await pdf.blob.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('generated-pdfs')
                .upload(filename, buffer, {
                    contentType: 'application/pdf',
                    upsert: false
                })

            if (uploadError) {
                console.error(`[API] Failed to upload PDF for ${pdf.supplier}:`, uploadError)
                // Continue? Or fail? Better to fail because data consistency is key.
                throw new Error(`Failed to upload PDF: ${uploadError.message}`)
            }

            const pdfPath = uploadData.path
            console.log(`[API] Uploaded PDF for ${pdf.supplier} to ${pdfPath}`)

            const supplierItems = parsedData[pdf.supplier] || []
            supplierItems.forEach((item: InvoiceItemForm) => {
                allItems.push({
                    ...item,
                    supplier: pdf.supplier,
                    invoice_number: pdf.invoiceNumber,
                    pdf_file_path: pdfPath, // Use actual storage path
                })
            })
        }

        // Save invoice items to database
        await createInvoiceItems(invoiceHistory.id, allItems)
        console.log('[API] ✅ Invoice saved to database:', invoiceHistory.id)

        // Convert blobs to base64 for transport
        const pdfsData = await Promise.all(
            pdfs.map(async (pdf) => ({
                supplier: pdf.supplier,
                invoiceNumber: pdf.invoiceNumber,
                blob: await blobToBase64(pdf.blob),
            }))
        )

        return NextResponse.json({
            historyId: invoiceHistory.id,
            pdfs: pdfsData
        })
    } catch (error) {
        console.error('Error generating PDFs:', error)
        return NextResponse.json(
            { error: 'Failed to generate PDFs', details: (error as Error).message },
            { status: 500 }
        )
    }
}

// Helper to convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return base64
}
