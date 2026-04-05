import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceById, deleteInvoiceHistory } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'

// Pastikan route ini selalu dynamic dan tidak ter-cache di Vercel
export const dynamic = 'force-dynamic'

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

// PATCH /api/invoices/[id] - Update invoice (items, metadata, add/delete items & suppliers)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const {
            items,
            status,
            batch_name,
            invoice_date,
            new_items,
            delete_item_ids,
        } = body

        console.log('[API] PATCH request:', {
            id,
            hasItems: !!items,
            status,
            batch_name,
            invoice_date,
            newItemsCount: new_items?.length,
            deleteItemIds: delete_item_ids?.length,
        })

        const supabase = await createClient()

        // Handle status-only update (quick path)
        if (status && !items && !new_items && !delete_item_ids && !batch_name && !invoice_date) {
            console.log('[API] Updating invoice status to:', status)

            const { error: statusError } = await supabase
                .from('invoice_history')
                .update({ status })
                .eq('id', id)

            if (statusError) {
                console.error('[API] Error updating status:', statusError)
                throw statusError
            }

            return NextResponse.json({ success: true })
        }

        // ========================================
        // FULL EDIT: metadata + items + add/delete
        // ========================================

        // 1. Update invoice_history metadata (batch_name, invoice_date, status)
        const historyUpdates: Record<string, any> = {}
        if (batch_name !== undefined) historyUpdates.batch_name = batch_name
        if (invoice_date !== undefined) historyUpdates.invoice_date = invoice_date
        if (status !== undefined) historyUpdates.status = status

        if (Object.keys(historyUpdates).length > 0) {
            console.log('[API] Updating invoice_history metadata:', historyUpdates)
            const { error } = await supabase
                .from('invoice_history')
                .update(historyUpdates)
                .eq('id', id)

            if (error) {
                console.error('[API] Error updating invoice_history:', error)
                throw error
            }
        }

        // 2. Delete items
        if (delete_item_ids && delete_item_ids.length > 0) {
            console.log('[API] Deleting items:', delete_item_ids)

            // Get PDF paths of items to delete
            const { data: itemsToDelete } = await supabase
                .from('invoice_items')
                .select('pdf_file_path, supplier')
                .in('id', delete_item_ids)

            const { error } = await supabase
                .from('invoice_items')
                .delete()
                .in('id', delete_item_ids)

            if (error) {
                console.error('[API] Error deleting items:', error)
                throw error
            }

            // Note: PDF cleanup happens after regeneration below
        }

        // 3. Update existing items
        if (items && items.length > 0) {
            console.log('[API] Updating items:', items.length)

            for (const item of items) {
                const { error } = await supabase
                    .from('invoice_items')
                    .update({
                        supplier: item.supplier,
                        invoice_number: item.invoice_number,
                        item_name: item.item_name,
                        quantity: parseFloat(item.quantity),
                        unit: item.unit,
                        price: parseFloat(item.price),
                        total: parseFloat(item.total),
                    })
                    .eq('id', item.id)

                if (error) {
                    console.error('[API] Error updating item:', item.id, error)
                    throw error
                }
            }
        }

        // 4. Add new items
        if (new_items && new_items.length > 0) {
            console.log('[API] Adding new items:', new_items.length)

            const insertData = new_items.map((item: any) => ({
                history_id: id,
                supplier: item.supplier,
                invoice_number: item.invoice_number || '#KWITANSI0001',
                item_name: item.item_name,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                price: parseFloat(item.price),
                total: parseFloat(item.total),
                pdf_file_path: 'pending-regeneration',
            }))

            const { error } = await supabase
                .from('invoice_items')
                .insert(insertData)

            if (error) {
                console.error('[API] Error inserting new items:', error)
                throw error
            }
        }

        // 5. Recalculate invoice totals from current items
        const { data: allItems, error: fetchError } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('history_id', id)

        if (fetchError) {
            console.error('[API] Error fetching all items:', fetchError)
            throw fetchError
        }

        const grandTotal = allItems.reduce((sum: number, item: any) => sum + item.total, 0)
        const uniqueSuppliers = new Set(allItems.map((item: any) => item.supplier))

        const { error: totalsError } = await supabase
            .from('invoice_history')
            .update({
                grand_total: grandTotal,
                total_items: allItems.length,
                total_suppliers: uniqueSuppliers.size,
            })
            .eq('id', id)

        if (totalsError) {
            console.error('[API] Error updating totals:', totalsError)
            throw totalsError
        }

        // 6. Regenerate PDFs if any item data changed
        const hasDataChanges = items?.length > 0 || new_items?.length > 0 || delete_item_ids?.length > 0 || invoice_date

        if (hasDataChanges && allItems.length > 0) {
            console.log('[API] Regenerating PDFs...')

            // Get the latest invoice_date
            const { data: invoiceHistory, error: historyError } = await supabase
                .from('invoice_history')
                .select('invoice_date')
                .eq('id', id)
                .single()

            if (historyError) throw historyError

            // Group items by supplier
            const itemsBySupplier: Record<string, any[]> = {}
            allItems.forEach((item: any) => {
                if (!itemsBySupplier[item.supplier]) {
                    itemsBySupplier[item.supplier] = []
                }
                itemsBySupplier[item.supplier].push(item)
            })

            const { pdf } = await import('@react-pdf/renderer')
            const { JayamenTemplate } = await import('@/lib/pdf/templates/jayamen-template')
            const { UndiYuwonoTemplate } = await import('@/lib/pdf/templates/undi-yuwono-template')
            const { SekarWijayakusumaTemplate } = await import('@/lib/pdf/templates/sekar-wijayakusuma-template')

            const invoiceDate_parsed = new Date(invoiceHistory.invoice_date)

            for (const [supplier, supplierItems] of Object.entries(itemsBySupplier)) {
                const invoiceNumber = supplierItems[0]?.invoice_number || '#KWITANSI0001'
                const oldPdfPath = supplierItems[0]?.pdf_file_path

                console.log(`[API] Regenerating PDF for ${supplier}...`)

                const pdfItems = supplierItems.map((item: any) => ({
                    supplier: item.supplier,
                    item_name: item.item_name,
                    quantity: item.quantity,
                    unit: item.unit,
                    price: item.price,
                    total: item.total,
                }))

                let template
                if (supplier.includes('JAYAMEN')) {
                    template = JayamenTemplate({ invoiceNumber, invoiceDate: invoiceDate_parsed, items: pdfItems })
                } else if (supplier.includes('UNDI') || supplier.includes('YUWONO')) {
                    template = UndiYuwonoTemplate({ invoiceNumber, invoiceDate: invoiceDate_parsed, items: pdfItems })
                } else if (supplier.includes('SEKAR') || supplier.includes('WIJAYAKUSUMA')) {
                    template = SekarWijayakusumaTemplate({ invoiceNumber, invoiceDate: invoiceDate_parsed, items: pdfItems })
                } else {
                    template = JayamenTemplate({ invoiceNumber, invoiceDate: invoiceDate_parsed, items: pdfItems })
                }

                const pdfBlob = await pdf(template).toBlob()
                const arrayBuffer = await pdfBlob.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                // Delete old PDF
                if (oldPdfPath && oldPdfPath !== 'client-side-download' && oldPdfPath !== 'pending-regeneration') {
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
                        upsert: false,
                    })

                if (uploadError) {
                    throw new Error(`Failed to upload PDF: ${uploadError.message}`)
                }

                // Update all items for this supplier with new PDF path
                const supplierItemIds = supplierItems.map((item: any) => item.id)
                const { error: pathUpdateError } = await supabase
                    .from('invoice_items')
                    .update({ pdf_file_path: uploadData.path })
                    .in('id', supplierItemIds)

                if (pathUpdateError) throw pathUpdateError
            }

            console.log('[API] PDFs regenerated successfully')
        }

        return NextResponse.json({ success: true })
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
