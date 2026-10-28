import { NextRequest, NextResponse } from 'next/server'
import { canAccessInvoice, getInvoiceById } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'
import { generateInvoicePDFsFromItems, StoredInvoiceItem } from '@/lib/pdf/pdf-generator'

export const dynamic = 'force-dynamic'

// Render ulang semua PDF satu invoice dari DB untuk preview/download di
// /history. PDF tidak lagi disimpan di storage supaya kuota Supabase tidak
// habis — base64 di JSON, sama seperti POST /api/generate-pdf.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const hasAccess = await canAccessInvoice(supabase, user.id, id)
        if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const invoice = await getInvoiceById(id)
        const { pdfs, unrecognizedSuppliers } = await generateInvoicePDFsFromItems(
            invoice.items as StoredInvoiceItem[],
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
        console.error('Error rendering invoice PDFs:', error)
        return NextResponse.json({ error: 'Failed to render PDFs' }, { status: 500 })
    }
}
