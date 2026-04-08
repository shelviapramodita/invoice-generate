import { NextRequest, NextResponse } from 'next/server'
import { generateInvoicePDFsWithNumbers, GeneratedPDF } from '@/lib/pdf/pdf-generator'
import { ParsedExcelData, InvoiceItemForm } from '@/types'

function isSupabaseConfigured(): boolean {
    return !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your-project-url' &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'your-anon-key'
    )
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { parsedData, invoiceDate, batchName, invoiceNumbers, customerNames } = body

        if (!parsedData) {
            return NextResponse.json(
                { error: 'Missing parsed data' },
                { status: 400 }
            )
        }

        const parsedDate = new Date(invoiceDate + 'T12:00:00')
        const pdfs = await generateInvoicePDFsWithNumbers(parsedData as ParsedExcelData, {
            invoiceDate: parsedDate,
            batchName,
            invoiceNumbers,
            customerNames,
        })

        const pdfsData = await Promise.all(
            pdfs.map(async (pdf) => ({
                supplier: pdf.supplier,
                invoiceNumber: pdf.invoiceNumber,
                blob: await blobToBase64(pdf.blob),
            }))
        )

        let historyId: string | null = null

        if (isSupabaseConfigured()) {
            try {
                const { createInvoiceHistory, createInvoiceItems } = await import('@/lib/db/queries')
                const { createClient } = await import('@/lib/supabase/server')

                const supabase = await createClient()
                const { data: { user } } = await supabase.auth.getUser()

                const suppliers = Object.keys(parsedData)
                let totalItems = 0
                let grandTotal = 0
                Object.values(parsedData as ParsedExcelData).forEach((items) => {
                    if (!items) return
                    totalItems += items.length
                    items.forEach((item) => { grandTotal += item.total })
                })

                const invoiceHistory = await createInvoiceHistory({
                    batch_name: batchName || undefined,
                    invoice_date: parsedDate,
                    total_suppliers: suppliers.length,
                    total_items: totalItems,
                    grand_total: grandTotal,
                    status: 'generated',
                    user_id: user?.id || '',
                })
                historyId = invoiceHistory.id

                const allItems: Array<InvoiceItemForm & { supplier: string; invoice_number: string; pdf_file_path: string }> = []

                for (const pdf of pdfs) {
                    const safeSupplier = pdf.supplier.replace(/[^a-zA-Z0-9.-]/g, '-')
                    const safeInvoiceNumber = pdf.invoiceNumber.replace(/[^a-zA-Z0-9.-]/g, '-')
                    const filename = `${Date.now()}-${safeSupplier}-${safeInvoiceNumber}.pdf`

                    const arrayBuffer = await pdf.blob.arrayBuffer()
                    const buffer = Buffer.from(arrayBuffer)

                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('generated-pdfs')
                        .upload(filename, buffer, { contentType: 'application/pdf', upsert: false })

                    const pdfPath = uploadError ? 'client-side-download' : uploadData.path
                    if (uploadError) {
                        console.warn('Storage upload failed:', uploadError.message)
                    }

                    const supplierItems = parsedData[pdf.supplier] || []
                    supplierItems.forEach((item: InvoiceItemForm) => {
                        allItems.push({ ...item, supplier: pdf.supplier, invoice_number: pdf.invoiceNumber, pdf_file_path: pdfPath })
                    })
                }

                await createInvoiceItems(invoiceHistory.id, allItems)
            } catch (dbError) {
                console.error('Failed to save to database:', (dbError as Error).message)
            }
        }

        return NextResponse.json({ historyId, pdfs: pdfsData })

    } catch (error) {
        console.error('Error generating PDFs:', error)
        return NextResponse.json(
            { error: 'Failed to generate PDFs' },
            { status: 500 }
        )
    }
}

async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
}
