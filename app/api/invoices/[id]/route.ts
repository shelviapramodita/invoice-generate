import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceById, deleteInvoiceHistory } from '@/lib/db/queries'
import { getSupabase } from '@/lib/supabase/client'

const supabase = getSupabase()

// GET /api/invoices/[id] - Get invoice detail
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const invoice = await getInvoiceById(id)

        return NextResponse.json({
            success: true,
            data: invoice,
        })
    } catch (error: any) {
        console.error('[API] Error fetching invoice:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch invoice',
                message: error.message || 'Unknown error',
            },
            { status: 500 }
        )
    }
}

// PATCH /api/invoices/[id] - Update invoice items or status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { items, status } = body

        console.log('[API] PATCH request:', { id, hasItems: !!items, status })

        if (!supabase) {
            throw new Error('Supabase client not initialized')
        }

        // Handle status update
        if (status) {
            console.log('[API] Updating invoice status to:', status)

            const { error: statusError } = await supabase
                .from('invoice_history')
                .update({ status })
                .eq('id', id)

            if (statusError) {
                console.error('[API] Error updating status:', statusError)
                throw statusError
            }

            console.log('[API] Status updated successfully')
            return NextResponse.json({ success: true })
        }

        // Handle items update
        if (items && items.length > 0) {
            console.log('[API] Updating invoice items:', { id, itemCount: items.length })

            // Update each item
            for (const item of items) {
                console.log('[API] Updating item:', item.id)

                const { error } = await supabase
                    .from('invoice_items')
                    .update({
                        item_name: item.item_name,
                        quantity: parseFloat(item.quantity),
                        unit: item.unit,
                        price: parseFloat(item.price),
                        total: parseFloat(item.total),
                    })
                    .eq('id', item.id)

                if (error) {
                    console.error('[API] Error updating item:', error)
                    throw error
                }
            }

            // Recalculate invoice totals
            const { data: updatedItems, error: fetchError } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('history_id', id)

            if (fetchError) {
                console.error('[API] Error fetching updated items:', fetchError)
                throw fetchError
            }

            const grandTotal = updatedItems.reduce((sum: number, item: any) => sum + item.total, 0)

            console.log('[API] Updating grand total:', grandTotal)

            const { error: updateError } = await supabase
                .from('invoice_history')
                .update({ grand_total: grandTotal })
                .eq('id', id)

            if (updateError) {
                console.error('[API] Error updating grand total:', updateError)
                throw updateError
            }

            // ========================================
            // REGENERATE PDFs with updated data
            // ========================================
            console.log('[API] Regenerating PDFs with updated data...')

            // Get invoice history to get invoice_date
            const { data: invoiceHistory, error: historyError } = await supabase
                .from('invoice_history')
                .select('invoice_date')
                .eq('id', id)
                .single()

            if (historyError) {
                console.error('[API] Error fetching invoice history:', historyError)
                throw historyError
            }

            // Group items by supplier
            const itemsBySupplier: Record<string, any[]> = {}
            updatedItems.forEach((item: any) => {
                if (!itemsBySupplier[item.supplier]) {
                    itemsBySupplier[item.supplier] = []
                }
                itemsBySupplier[item.supplier].push(item)
            })

            // Import PDF generator dynamically
            const { pdf } = await import('@react-pdf/renderer')
            const { JayamenTemplate } = await import('@/lib/pdf/templates/jayamen-template')
            const { UndiYuwonoTemplate } = await import('@/lib/pdf/templates/undi-yuwono-template')
            const { SekarWijayakusumaTemplate } = await import('@/lib/pdf/templates/sekar-wijayakusuma-template')

            const invoiceDate = new Date(invoiceHistory.invoice_date)

            // Generate new PDFs for each supplier
            for (const [supplier, supplierItems] of Object.entries(itemsBySupplier)) {
                const invoiceNumber = supplierItems[0]?.invoice_number || '#KWITANSI0001'
                const oldPdfPath = supplierItems[0]?.pdf_file_path

                console.log(`[API] Regenerating PDF for ${supplier}...`)

                // Select template based on supplier
                let template
                const items = supplierItems.map((item: any) => ({
                    supplier: item.supplier,
                    item_name: item.item_name,
                    quantity: item.quantity,
                    unit: item.unit,
                    price: item.price,
                    total: item.total,
                }))

                if (supplier.includes('JAYAMEN')) {
                    template = JayamenTemplate({ invoiceNumber, invoiceDate, items })
                } else if (supplier.includes('UNDI') || supplier.includes('YUWONO')) {
                    template = UndiYuwonoTemplate({ invoiceNumber, invoiceDate, items })
                } else if (supplier.includes('SEKAR') || supplier.includes('WIJAYAKUSUMA')) {
                    template = SekarWijayakusumaTemplate({ invoiceNumber, invoiceDate, items })
                } else {
                    template = JayamenTemplate({ invoiceNumber, invoiceDate, items })
                }

                // Generate PDF blob
                const pdfBlob = await pdf(template).toBlob()
                const arrayBuffer = await pdfBlob.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                // Delete old PDF from storage (if exists and not client-side)
                if (oldPdfPath && oldPdfPath !== 'client-side-download') {
                    console.log(`[API] Deleting old PDF: ${oldPdfPath}`)
                    await supabase.storage.from('generated-pdfs').remove([oldPdfPath])
                }

                // Upload new PDF
                const safeSupplier = supplier.replace(/[^a-zA-Z0-9.-]/g, '-')
                const safeInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9.-]/g, '-')
                const newFilename = `${Date.now()}-${safeSupplier}-${safeInvoiceNumber}.pdf`

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('generated-pdfs')
                    .upload(newFilename, buffer, {
                        contentType: 'application/pdf',
                        upsert: false
                    })

                if (uploadError) {
                    console.error(`[API] Failed to upload new PDF for ${supplier}:`, uploadError)
                    throw new Error(`Failed to upload PDF: ${uploadError.message}`)
                }

                const newPdfPath = uploadData.path
                console.log(`[API] Uploaded new PDF for ${supplier} to ${newPdfPath}`)

                // Update all items for this supplier with new PDF path
                const supplierItemIds = supplierItems.map((item: any) => item.id)
                const { error: pathUpdateError } = await supabase
                    .from('invoice_items')
                    .update({ pdf_file_path: newPdfPath })
                    .in('id', supplierItemIds)

                if (pathUpdateError) {
                    console.error(`[API] Error updating PDF path for ${supplier}:`, pathUpdateError)
                    throw pathUpdateError
                }
            }

            console.log('[API] ✅ Invoice items updated and PDFs regenerated successfully')
            return NextResponse.json({ success: true })
        }

        // No valid update data provided
        return NextResponse.json(
            { success: false, message: 'No update data provided' },
            { status: 400 }
        )
    } catch (error: any) {
        console.error('[API] Error updating invoice:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to update invoice',
                message: error.message || 'Unknown error',
            },
            { status: 500 }
        )
    }
}

// DELETE /api/invoices/[id] - Delete invoice
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // TODO: Also delete files from storage
        await deleteInvoiceHistory(id)

        return NextResponse.json({
            success: true,
            message: 'Invoice deleted successfully',
        })
    } catch (error: any) {
        console.error('[API] Error deleting invoice:', error)
        return NextResponse.json(
            {
                error: 'Failed to delete invoice',
                message: error.message || 'Unknown error',
            },
            { status: 500 }
        )
    }
}
