import { createClient } from '@/lib/supabase/server'
import { InvoiceItemForm } from '@/types'

export async function createInvoiceHistory(data: {
    batch_name?: string
    invoice_date: Date
    total_suppliers: number
    total_items: number
    grand_total: number
    status: 'generated' | 'completed'
    user_id: string
}) {
    const supabase = await createClient()

    const { data: invoice, error } = await supabase
        .from('invoice_history')
        .insert({
            batch_name: data.batch_name || null,
            invoice_date: data.invoice_date.toISOString(),
            total_suppliers: data.total_suppliers,
            total_items: data.total_items,
            grand_total: data.grand_total,
            status: data.status,
            user_id: data.user_id,
        })
        .select()
        .single()

    if (error) throw new Error(`Failed to create invoice history: ${error.message}`)
    return invoice
}

export async function createInvoiceItems(
    historyId: string,
    items: Array<InvoiceItemForm & {
        supplier: string
        invoice_number: string
        pdf_file_path: string
        customer_name?: string | null
    }>
) {
    const supabase = await createClient()

    const itemsToInsert = items.map((item) => ({
        history_id: historyId,
        supplier: item.supplier,
        invoice_number: item.invoice_number,
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        total: item.total,
        pdf_file_path: item.pdf_file_path,
        // customer_name = "Tagihan Kepada" (billing-to). Stored so user can
        // edit it from /history later without losing context.
        customer_name: item.customer_name ?? null,
    }))

    const { data, error } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)
        .select()

    if (error) throw new Error(`Failed to create invoice items: ${error.message}`)
    return data
}

export async function getInvoiceHistory(limit = 50) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('invoice_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) throw new Error(`Failed to fetch invoice history: ${error.message}`)
    return data
}

export async function getInvoiceById(id: string) {
    const supabase = await createClient()

    const { data: invoice, error: invoiceError } = await supabase
        .from('invoice_history')
        .select('*')
        .eq('id', id)
        .single()

    if (invoiceError) throw new Error(`Failed to fetch invoice: ${invoiceError.message}`)

    const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('history_id', id)
        .order('supplier', { ascending: true })

    if (itemsError) throw new Error(`Failed to fetch invoice items: ${itemsError.message}`)

    return { ...invoice, items }
}

export async function updateInvoiceHistory(
    id: string,
    updates: Partial<{
        batch_name: string
        status: 'generated' | 'completed'
    }>
) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('invoice_history')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw new Error(`Failed to update invoice history: ${error.message}`)
    return data
}

export async function deleteInvoiceHistory(id: string) {
    const supabase = await createClient()

    const { data: items, error: fetchError } = await supabase
        .from('invoice_items')
        .select('pdf_file_path')
        .eq('history_id', id)

    if (fetchError) throw new Error(`Failed to fetch invoice items: ${fetchError.message}`)

    const pdfPaths = Array.from(
        new Set(
            items
                ?.map(item => item.pdf_file_path)
                .filter(path => path && path !== 'client-side-download')
        ) || []
    )

    const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('history_id', id)
    if (itemsError) throw new Error(`Failed to delete invoice items: ${itemsError.message}`)

    const { error } = await supabase
        .from('invoice_history')
        .delete()
        .eq('id', id)
    if (error) throw new Error(`Failed to delete invoice history: ${error.message}`)

    if (pdfPaths.length > 0) {
        await supabase.storage.from('generated-pdfs').remove(pdfPaths)
    }

    return { success: true }
}

export async function bulkDeleteInvoiceHistory(ids: string[]) {
    const supabase = await createClient()

    if (!ids || ids.length === 0) {
        throw new Error('No invoice IDs provided')
    }

    const { data: items, error: fetchError } = await supabase
        .from('invoice_items')
        .select('pdf_file_path')
        .in('history_id', ids)
    if (fetchError) throw new Error(`Failed to fetch invoice items: ${fetchError.message}`)

    const pdfPaths = Array.from(
        new Set(
            items
                ?.map(item => item.pdf_file_path)
                .filter(path => path && path !== 'client-side-download')
        ) || []
    )

    const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .in('history_id', ids)
    if (itemsError) throw new Error(`Failed to delete invoice items: ${itemsError.message}`)

    const { error } = await supabase
        .from('invoice_history')
        .delete()
        .in('id', ids)
    if (error) throw new Error(`Failed to delete invoice history: ${error.message}`)

    if (pdfPaths.length > 0) {
        await supabase.storage.from('generated-pdfs').remove(pdfPaths)
    }

    return { success: true, deletedCount: ids.length }
}
