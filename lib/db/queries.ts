import { createClient } from '@/lib/supabase/server'
import { InvoiceItemForm } from '@/types'

/**
 * Create new invoice history record
 */
export async function createInvoiceHistory(data: {
    batch_name?: string
    invoice_date: Date
    total_suppliers: number
    total_items: number
    grand_total: number
    status: 'generated' | 'completed'
}) {
    const supabase = await createClient()

    const { data: invoice, error } = await supabase
        .from('invoice_history')
        .insert({
            batch_name: data.batch_name || null,
            invoice_date: data.invoice_date.toISOString(),
            // excel_file_path: data.excel_file_path, // Removed - column doesn't exist in Supabase
            total_suppliers: data.total_suppliers,
            total_items: data.total_items,
            grand_total: data.grand_total,
            status: data.status,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating invoice history:', error)
        throw new Error(`Failed to create invoice history: ${error.message}`)
    }

    return invoice
}

/**
 * Create invoice items (bulk insert)
 */
export async function createInvoiceItems(
    historyId: string,
    items: Array<InvoiceItemForm & {
        supplier: string
        invoice_number: string
        pdf_file_path: string
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
    }))

    const { data, error } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)
        .select()

    if (error) {
        console.error('Error creating invoice items:', error)
        throw new Error(`Failed to create invoice items: ${error.message}`)
    }

    return data
}

/**
 * Get all invoice history (sorted by created_at desc)
 */
export async function getInvoiceHistory(limit = 50) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('invoice_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching invoice history:', error)
        throw new Error(`Failed to fetch invoice history: ${error.message}`)
    }

    return data
}

/**
 * Get invoice by ID with all items
 */
export async function getInvoiceById(id: string) {
    const supabase = await createClient()

    // Get invoice history
    const { data: invoice, error: invoiceError } = await supabase
        .from('invoice_history')
        .select('*')
        .eq('id', id)
        .single()

    if (invoiceError) {
        console.error('Error fetching invoice:', invoiceError)
        throw new Error(`Failed to fetch invoice: ${invoiceError.message}`)
    }

    // Get invoice items
    const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('history_id', id)
        .order('supplier', { ascending: true })

    if (itemsError) {
        console.error('Error fetching invoice items:', itemsError)
        throw new Error(`Failed to fetch invoice items: ${itemsError.message}`)
    }

    return {
        ...invoice,
        items,
    }
}

/**
 * Update invoice history
 */
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

    if (error) {
        console.error('Error updating invoice history:', error)
        throw new Error(`Failed to update invoice history: ${error.message}`)
    }

    return data
}

/**
 * Delete invoice history and all related items
 */
export async function deleteInvoiceHistory(id: string) {
    const supabase = await createClient()

    // Delete items first (cascade should handle this, but explicit is safer)
    const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('history_id', id)

    if (itemsError) {
        console.error('Error deleting invoice items:', itemsError)
        throw new Error(`Failed to delete invoice items: ${itemsError.message}`)
    }

    // Delete invoice history
    const { error } = await supabase
        .from('invoice_history')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting invoice history:', error)
        throw new Error(`Failed to delete invoice history: ${error.message}`)
    }

    return { success: true }
}
