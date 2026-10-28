import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { convexQuery, errorResponse } from '@/lib/convex/server'
import { generateInvoicePDFsFromItems } from '@/lib/pdf/pdf-generator'

export const dynamic = 'force-dynamic'

// Render ulang semua PDF satu invoice dari data di Convex untuk preview/download
// di /history. PDF tidak disimpan di storage — base64 di JSON, sama seperti
// POST /api/generate-pdf.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const invoice = await convexQuery(api.invoices.get, { id: id as Id<'invoice_history'> })
        const { pdfs, unrecognizedSuppliers } = await generateInvoicePDFsFromItems(
            invoice.items,
            new Date(invoice.invoice_date)
        )

        const pdfsData = await Promise.all(
            pdfs.map(async (pdf) => ({
                supplier: pdf.supplier,
                invoiceNumber: pdf.invoiceNumber,
                blob: Buffer.from(await pdf.blob.arrayBuffer()).toString('base64'),
            }))
        )

        return NextResponse.json({
            success: true,
            data: { batchName: invoice.batch_name, pdfs: pdfsData, unrecognizedSuppliers },
        })
    } catch (error) {
        return errorResponse(error, 'Failed to render PDFs')
    }
}
