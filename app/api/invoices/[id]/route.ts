import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceById, deleteInvoiceHistory, canAccessInvoice, isStoredPdfPath, ON_DEMAND_PDF_PATH } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'
import { getSupplierTemplateKey } from '@/lib/pdf/utils'

export const dynamic = 'force-dynamic'

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

        return NextResponse.json({ success: true, data: invoice })
    } catch (error: any) {
        console.error('Error fetching invoice:', error)
        return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { items, status, batch_name, invoice_date, new_items, delete_item_ids } = body

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const hasAccess = await canAccessInvoice(supabase, user.id, id)
        if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        if (status && !items && !new_items && !delete_item_ids && !batch_name && !invoice_date) {
            const { error: statusError } = await supabase
                .from('invoice_history')
                .update({ status })
                .eq('id', id)

            if (statusError) throw statusError
            return NextResponse.json({ success: true })
        }

        const historyUpdates: Record<string, any> = {}
        if (batch_name !== undefined) historyUpdates.batch_name = batch_name
        if (invoice_date !== undefined) historyUpdates.invoice_date = invoice_date
        if (status !== undefined) historyUpdates.status = status

        if (Object.keys(historyUpdates).length > 0) {
            const { error } = await supabase
                .from('invoice_history')
                .update(historyUpdates)
                .eq('id', id)
            if (error) throw error
        }

        if (delete_item_ids && delete_item_ids.length > 0) {
            const { error } = await supabase
                .from('invoice_items')
                .delete()
                .in('id', delete_item_ids)
            if (error) throw error
        }

        if (items && items.length > 0) {
            for (const item of items) {
                const qty = parseFloat(item.quantity)
                const price = parseFloat(item.price)
                const total = parseFloat(item.total)

                if (isNaN(qty) || qty < 0 || isNaN(price) || price < 0 || isNaN(total)) {
                    return NextResponse.json(
                        { error: 'Data item tidak valid: angka harus positif' },
                        { status: 400 }
                    )
                }

                const updatePayload: Record<string, any> = {
                    supplier: item.supplier,
                    invoice_number: item.invoice_number,
                    item_name: item.item_name,
                    quantity: qty,
                    unit: item.unit,
                    price: price,
                    total: total,
                }
                // customer_name only sent if user actually edited it. undefined → don't touch column.
                if (item.customer_name !== undefined) {
                    updatePayload.customer_name = item.customer_name
                }

                let { error: updateError } = await supabase
                    .from('invoice_items')
                    .update(updatePayload)
                    .eq('id', item.id)

                // Fallback if customer_name column doesn't exist yet
                if (updateError && /customer_name/i.test(updateError.message)) {
                    console.warn('[invoice_items UPDATE] customer_name column missing — retrying without it')
                    const { customer_name: _omit, ...rest } = updatePayload
                    void _omit
                    ;({ error: updateError } = await supabase
                        .from('invoice_items')
                        .update(rest)
                        .eq('id', item.id))
                }
                if (updateError) throw updateError
            }
        }

        if (new_items && new_items.length > 0) {
            const buildNewRow = (item: any, includeCustomerName: boolean) => {
                const row: Record<string, any> = {
                    history_id: id,
                    supplier: item.supplier,
                    invoice_number: item.invoice_number || '#0001',
                    item_name: item.item_name,
                    quantity: parseFloat(item.quantity),
                    unit: item.unit,
                    price: parseFloat(item.price),
                    total: parseFloat(item.total),
                    pdf_file_path: ON_DEMAND_PDF_PATH,
                }
                if (includeCustomerName) row.customer_name = item.customer_name ?? null
                return row
            }

            let { error: insertError } = await supabase
                .from('invoice_items')
                .insert(new_items.map((item: any) => buildNewRow(item, true)))

            // Fallback if customer_name column doesn't exist
            if (insertError && /customer_name/i.test(insertError.message)) {
                console.warn('[invoice_items INSERT new_items] customer_name column missing — retrying without it')
                ;({ error: insertError } = await supabase
                    .from('invoice_items')
                    .insert(new_items.map((item: any) => buildNewRow(item, false))))
            }
            if (insertError) throw insertError
        }

        const { data: allItems, error: fetchError } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('history_id', id)
        if (fetchError) throw fetchError

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
        if (totalsError) throw totalsError

        const hasDataChanges = items?.length > 0 || new_items?.length > 0 || delete_item_ids?.length > 0 || invoice_date
        // Suppliers found among the edited items that don't match any of the
        // 5 authorized CV/UMKM — no PDF is rendered for them rather than
        // silently becoming a Jayamen invoice.
        const unrecognizedSuppliers: string[] = []

        if (hasDataChanges && allItems.length > 0) {
            for (const supplier of uniqueSuppliers) {
                if (!getSupplierTemplateKey(supplier as string)) unrecognizedSuppliers.push(supplier as string)
            }

            // PDF di-render ulang dari DB saat dibuka (GET /api/invoices/[id]/pdfs),
            // jadi file lama di storage sudah basi — hapus supaya kuota lega.
            const storedItems = allItems.filter((item) => isStoredPdfPath(item.pdf_file_path))
            if (storedItems.length > 0) {
                const oldPaths = Array.from(new Set(storedItems.map((item) => item.pdf_file_path as string)))
                await supabase.storage.from('generated-pdfs').remove(oldPaths)

                const { error: pathUpdateError } = await supabase
                    .from('invoice_items')
                    .update({ pdf_file_path: ON_DEMAND_PDF_PATH })
                    .in('id', storedItems.map((item) => item.id))
                if (pathUpdateError) throw pathUpdateError
            }
        }

        return NextResponse.json({ success: true, unrecognizedSuppliers })
    } catch (error: any) {
        console.error('Error updating invoice:', error)
        return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
    }
}

export async function DELETE(
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

        await deleteInvoiceHistory(id)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting invoice:', error)
        return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
    }
}
