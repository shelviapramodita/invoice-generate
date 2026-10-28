import { NextRequest, NextResponse } from 'next/server'
import { generateInvoicePDFsWithNumbers } from '@/lib/pdf/pdf-generator'
import { ParsedExcelData, InvoiceItemForm } from '@/types'
import { api } from '@/convex/_generated/api'
import { convexMutation } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        // saveHistory=false dipakai saat user switch varian dokumen (TAGIHAN ⇄
        // KWITANSI) di halaman preview — PDF-nya cuma di-render ulang, jangan
        // sampai bikin baris invoice_history dobel untuk hari yang sama.
        const { parsedData, invoiceDate, batchName, invoiceNumbers, customerNames, documentType, saveHistory = true } = body

        if (!parsedData) {
            return NextResponse.json(
                { error: 'Missing parsed data' },
                { status: 400 }
            )
        }

        const parsedDate = new Date(invoiceDate + 'T12:00:00')
        const { pdfs, unrecognizedSuppliers } = await generateInvoicePDFsWithNumbers(parsedData as ParsedExcelData, {
            invoiceDate: parsedDate,
            batchName,
            invoiceNumbers,
            customerNames,
            documentType,
        })

        const pdfsData = await Promise.all(
            pdfs.map(async (pdf) => ({
                supplier: pdf.supplier,
                invoiceNumber: pdf.invoiceNumber,
                blob: await blobToBase64(pdf.blob),
            }))
        )

        let historyId: string | null = null

        if (saveHistory) {
            try {
                // PDF tidak disimpan — /history me-render ulang dari item ini
                // (GET /api/invoices/[id]/pdfs). Urutan array = urutan baris Excel.
                const items = pdfs.flatMap((pdf) =>
                    ((parsedData as ParsedExcelData)[pdf.supplier] || []).map((item: InvoiceItemForm) => ({
                        supplier: pdf.supplier,
                        invoice_number: pdf.invoiceNumber,
                        item_name: item.item_name,
                        quantity: item.quantity,
                        unit: item.unit,
                        price: item.price,
                        total: item.total,
                        // "Tagihan Kepada" per supplier, bisa diedit di /history
                        customer_name: customerNames?.[pdf.supplier] ?? null,
                    }))
                )

                historyId = await convexMutation(api.invoices.create, {
                    batch_name: batchName || null,
                    invoice_date: parsedDate.toISOString(),
                    items,
                })
            } catch (dbError) {
                // PDF tetap dikembalikan ke user walau riwayat gagal disimpan
                console.error('[generate-pdf] Failed to save invoice history:', dbError)
            }
        }

        return NextResponse.json({ historyId, pdfs: pdfsData, unrecognizedSuppliers })

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
