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
                .select('total')
                .eq('history_id', id)

            if (fetchError) {
                console.error('[API] Error fetching updated items:', fetchError)
                throw fetchError
            }

            const grandTotal = updatedItems.reduce((sum: number, item: { total: number }) => sum + item.total, 0)

            console.log('[API] Updating grand total:', grandTotal)

            const { error: updateError } = await supabase
                .from('invoice_history')
                .update({ grand_total: grandTotal })
                .eq('id', id)

            if (updateError) {
                console.error('[API] Error updating grand total:', updateError)
                throw updateError
            }

            console.log('[API] Invoice items updated successfully')
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
