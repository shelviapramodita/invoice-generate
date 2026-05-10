import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceById, deleteInvoiceHistory } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function checkAccess(supabase: any, userId: string, invoiceId: string) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

    if (profile?.role === 'admin') return true

    const { data: invoice } = await supabase
        .from('invoice_history')
        .select('user_id')
        .eq('id', invoiceId)
        .single()

    return invoice?.user_id === userId
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const hasAccess = await checkAccess(supabase, user.id, id)
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

        const hasAccess = await checkAccess(supabase, user.id, id)
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

                const { error } = await supabase
                    .from('invoice_items')
                    .update(updatePayload)
                    .eq('id', item.id)
                if (error) throw error
            }
        }

        if (new_items && new_items.length > 0) {
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
                customer_name: item.customer_name ?? null,
            }))

            const { error } = await supabase
                .from('invoice_items')
                .insert(insertData)
            if (error) throw error
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

        if (hasDataChanges && allItems.length > 0) {
            const { data: invoiceHistory, error: historyError } = await supabase
                .from('invoice_history')
                .select('invoice_date')
                .eq('id', id)
                .single()
            if (historyError) throw historyError

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

            const invoiceDateParsed = new Date(invoiceHistory.invoice_date)

            for (const [supplier, supplierItems] of Object.entries(itemsBySupplier)) {
                const invoiceNumber = supplierItems[0]?.invoice_number || '#KWITANSI0001'
                const oldPdfPath = supplierItems[0]?.pdf_file_path
                // customer_name = "Tagihan Kepada" — same for all items of one supplier
                // (per the upload flow). Read from first item in the group.
                const customerName = supplierItems[0]?.customer_name || undefined

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
                    template = JayamenTemplate({ invoiceNumber, invoiceDate: invoiceDateParsed, items: pdfItems, customerName })
                } else if (supplier.includes('UNDI') || supplier.includes('YUWONO')) {
                    template = UndiYuwonoTemplate({ invoiceNumber, invoiceDate: invoiceDateParsed, items: pdfItems, customerName })
                } else if (supplier.includes('SEKAR') || supplier.includes('WIJAYAKUSUMA')) {
                    template = SekarWijayakusumaTemplate({ invoiceNumber, invoiceDate: invoiceDateParsed, items: pdfItems, customerName })
                } else {
                    template = JayamenTemplate({ invoiceNumber, invoiceDate: invoiceDateParsed, items: pdfItems, customerName })
                }

                const pdfBlob = await pdf(template).toBlob()
                const arrayBuffer = await pdfBlob.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                if (oldPdfPath && oldPdfPath !== 'client-side-download' && oldPdfPath !== 'pending-regeneration') {
                    await supabase.storage.from('generated-pdfs').remove([oldPdfPath])
                }

                const safeSupplier = supplier.replace(/[^a-zA-Z0-9.-]/g, '-')
                const safeInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9.-]/g, '-')
                const newFilename = `${Date.now()}-${safeSupplier}-${safeInvoiceNumber}.pdf`

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('generated-pdfs')
                    .upload(newFilename, buffer, { contentType: 'application/pdf', upsert: false })

                if (uploadError) throw new Error(`Failed to upload PDF: ${uploadError.message}`)

                const supplierItemIds = supplierItems.map((item: any) => item.id)
                const { error: pathUpdateError } = await supabase
                    .from('invoice_items')
                    .update({ pdf_file_path: uploadData.path })
                    .in('id', supplierItemIds)
                if (pathUpdateError) throw pathUpdateError
            }
        }

        return NextResponse.json({ success: true })
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

        const hasAccess = await checkAccess(supabase, user.id, id)
        if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        await deleteInvoiceHistory(id)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting invoice:', error)
        return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
    }
}
