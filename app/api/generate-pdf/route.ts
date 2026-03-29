import { NextRequest, NextResponse } from 'next/server'
import { generateInvoicePDFsWithNumbers, GeneratedPDF } from '@/lib/pdf/pdf-generator'
import { ParsedExcelData, InvoiceItemForm } from '@/types'

// Check if Supabase is configured
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

        // ─── Step 1: Generate PDFs (always runs, no Supabase needed) ───────────
        const parsedDate = new Date(invoiceDate + 'T12:00:00')
        const pdfs = await generateInvoicePDFsWithNumbers(parsedData as ParsedExcelData, {
            invoiceDate: parsedDate,
            batchName,
            invoiceNumbers,
            customerNames,
        })

        // Convert PDFs to base64 immediately so we can always return them
        const pdfsData = await Promise.all(
            pdfs.map(async (pdf) => ({
                supplier: pdf.supplier,
                invoiceNumber: pdf.invoiceNumber,
                blob: await blobToBase64(pdf.blob),
            }))
        )

        // ─── Step 2: Save to Supabase (optional — only if configured) ──────────
        let historyId: string | null = null

        if (isSupabaseConfigured()) {
            try {
                const { createInvoiceHistory, createInvoiceItems } = await import('@/lib/db/queries')
                const { createClient } = await import('@/lib/supabase/server')

                // Calculate summary
                const suppliers = Object.keys(parsedData)
                let totalItems = 0
                let grandTotal = 0
                Object.values(parsedData as ParsedExcelData).forEach((items) => {
                    if (!items) return
                    totalItems += items.length
                    items.forEach((item) => { grandTotal += item.total })
                })

                console.log('[API] Saving invoice to database...')
                const invoiceHistory = await createInvoiceHistory({
                    batch_name: batchName || undefined,
                    invoice_date: parsedDate,
                    total_suppliers: suppliers.length,
                    total_items: totalItems,
                    grand_total: grandTotal,
                    status: 'generated',
                })
                historyId = invoiceHistory.id

                // Upload PDFs to Supabase Storage
                const supabase = await createClient()
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
                        console.warn(`[API] Storage upload failed for ${pdf.supplier}:`, uploadError.message)
                    }

                    const supplierItems = parsedData[pdf.supplier] || []
                    supplierItems.forEach((item: InvoiceItemForm) => {
                        allItems.push({ ...item, supplier: pdf.supplier, invoice_number: pdf.invoiceNumber, pdf_file_path: pdfPath })
                    })
                }

                await createInvoiceItems(invoiceHistory.id, allItems)
                console.log('[API] ✅ Invoice saved to database:', invoiceHistory.id)
            } catch (dbError) {
                // DB save failed — log it but don't block the user from getting their PDF
                console.error('[API] ⚠️ Failed to save to database (non-critical):', (dbError as Error).message)
            }
        } else {
            console.log('[API] Supabase not configured — skipping database save. PDFs will be available for client-side download only.')
        }

        return NextResponse.json({ historyId, pdfs: pdfsData })

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
    return Buffer.from(buffer).toString('base64')
}
