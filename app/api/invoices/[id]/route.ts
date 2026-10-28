import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { convexMutation, convexQuery, errorResponse } from '@/lib/convex/server'
import { getSupplierTemplateKey } from '@/lib/pdf/utils'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

interface ItemInput {
    id?: string
    supplier: string
    invoice_number?: string
    item_name: string
    quantity: number | string
    unit: string
    price: number | string
    total: number | string
    customer_name?: string | null
}

// Ambil hanya kolom item yang disimpan; UI ikut mengirim field lain
// (history_id, created_at, pdf_file_path, ...) yang harus dibuang
function toItemFields(item: ItemInput) {
    return {
        supplier: item.supplier,
        invoice_number: item.invoice_number || '#0001',
        item_name: item.item_name,
        quantity: parseFloat(String(item.quantity)),
        unit: item.unit,
        price: parseFloat(String(item.price)),
        total: parseFloat(String(item.total)),
        // undefined = kolom tidak diubah
        ...(item.customer_name !== undefined ? { customer_name: item.customer_name } : {}),
    }
}

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params
        const invoice = await convexQuery(api.invoices.get, { id: id as Id<'invoice_history'> })
        return NextResponse.json({ success: true, data: invoice })
    } catch (error) {
        return errorResponse(error, 'Failed to fetch invoice')
    }
}

// Mengubah item/batch/tanggal/status. Tidak me-render PDF: preview/download
// di /history selalu me-render ulang dari data terbaru (GET .../pdfs).
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params
        const { items, status, batch_name, invoice_date, new_items, delete_item_ids } = await request.json()

        const suppliers = await convexMutation(api.invoices.update, {
            id: id as Id<'invoice_history'>,
            batch_name,
            invoice_date,
            status,
            items: (items as ItemInput[] | undefined)?.map((item) => ({
                id: item.id as Id<'invoice_items'>,
                ...toItemFields(item),
            })),
            new_items: (new_items as ItemInput[] | undefined)?.map(toItemFields),
            delete_item_ids,
        })

        // Suppliers found among the edited items that don't match any of the
        // 5 authorized CV/UMKM — no PDF is rendered for them rather than
        // silently becoming a Jayamen invoice.
        const unrecognizedSuppliers = (suppliers ?? []).filter((supplier) => !getSupplierTemplateKey(supplier))

        return NextResponse.json({ success: true, unrecognizedSuppliers })
    } catch (error) {
        return errorResponse(error, 'Failed to update invoice')
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params
        await convexMutation(api.invoices.remove, { id: id as Id<'invoice_history'> })
        return NextResponse.json({ success: true })
    } catch (error) {
        return errorResponse(error, 'Failed to delete invoice')
    }
}
