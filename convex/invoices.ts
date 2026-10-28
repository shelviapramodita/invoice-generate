import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { fail, isAdmin, requireUser, withId } from './lib/auth'

const itemFields = {
    supplier: v.string(),
    invoice_number: v.string(),
    item_name: v.string(),
    quantity: v.number(),
    unit: v.string(),
    price: v.number(),
    total: v.number(),
    customer_name: v.optional(v.union(v.string(), v.null())),
}

// Admin boleh akses semua invoice, user biasa cuma miliknya sendiri
async function requireInvoice(ctx: QueryCtx, id: Id<'invoice_history'>) {
    const user = await requireUser(ctx)
    const invoice = await ctx.db.get(id)
    if (!invoice) fail('NOT_FOUND', 'Invoice tidak ditemukan')
    if (!isAdmin(user) && invoice.user_id !== user._id) fail('FORBIDDEN', 'Forbidden')
    return invoice
}

async function getItems(ctx: QueryCtx, historyId: Id<'invoice_history'>) {
    return ctx.db
        .query('invoice_items')
        .withIndex('by_history', (q) => q.eq('history_id', historyId))
        .collect()
}

function assertValidNumbers(item: { quantity: number; price: number; total: number }) {
    const { quantity, price, total } = item
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(total)) {
        fail('BAD_REQUEST', 'Data item tidak valid: angka harus positif')
    }
}

// Total & daftar supplier dihitung ulang dari item yang tersisa
async function recomputeTotals(ctx: MutationCtx, historyId: Id<'invoice_history'>) {
    const items = await getItems(ctx, historyId)
    const suppliers = Array.from(new Set(items.map((item) => item.supplier)))
    await ctx.db.patch(historyId, {
        grand_total: items.reduce((sum, item) => sum + item.total, 0),
        total_items: items.length,
        total_suppliers: suppliers.length,
        suppliers,
    })
    return suppliers
}

async function deleteWithItems(ctx: MutationCtx, historyId: Id<'invoice_history'>) {
    for (const item of await getItems(ctx, historyId)) await ctx.db.delete(item._id)
    await ctx.db.delete(historyId)
}

function serializeHistory(history: Doc<'invoice_history'>) {
    const { legacy_id, ...rest } = withId(history)
    void legacy_id
    return rest
}

// GET /api/invoices — 50 terbaru; admin melihat semua
export const list = query({
    args: {},
    handler: async (ctx) => {
        const user = await requireUser(ctx)
        const rows = isAdmin(user)
            ? await ctx.db.query('invoice_history').withIndex('by_created').order('desc').take(50)
            : await ctx.db
                .query('invoice_history')
                .withIndex('by_user', (q) => q.eq('user_id', user._id))
                .order('desc')
                .take(50)
        return rows.map(serializeHistory)
    },
})

// GET /api/invoices/[id] dan sumber data render ulang PDF. Item diurutkan per
// supplier, lalu sesuai urutan baris Excel.
export const get = query({
    args: { id: v.id('invoice_history') },
    handler: async (ctx, { id }) => {
        const invoice = await requireInvoice(ctx, id)
        const items = (await getItems(ctx, id))
            .sort((a, b) => a.supplier.localeCompare(b.supplier) || a.position - b.position)
            .map(withId)
        return { ...serializeHistory(invoice), items }
    },
})

// POST /api/generate-pdf (saveHistory) — urutan items = urutan baris Excel
export const create = mutation({
    args: {
        batch_name: v.optional(v.union(v.string(), v.null())),
        invoice_date: v.string(),
        items: v.array(v.object(itemFields)),
    },
    handler: async (ctx, { batch_name, invoice_date, items }) => {
        const user = await requireUser(ctx)
        items.forEach(assertValidNumbers)

        const suppliers = Array.from(new Set(items.map((item) => item.supplier)))
        const historyId = await ctx.db.insert('invoice_history', {
            user_id: user._id,
            batch_name: batch_name || null,
            invoice_date,
            total_suppliers: suppliers.length,
            total_items: items.length,
            grand_total: items.reduce((sum, item) => sum + item.total, 0),
            suppliers,
            status: 'generated',
            created_at: new Date().toISOString(),
        })

        for (const [position, item] of items.entries()) {
            await ctx.db.insert('invoice_items', { ...item, history_id: historyId, position })
        }
        return historyId
    },
})

// PATCH /api/invoices/[id]. Mengembalikan daftar supplier setelah perubahan.
export const update = mutation({
    args: {
        id: v.id('invoice_history'),
        batch_name: v.optional(v.union(v.string(), v.null())),
        invoice_date: v.optional(v.string()),
        status: v.optional(v.union(v.literal('generated'), v.literal('completed'))),
        items: v.optional(v.array(v.object({ id: v.id('invoice_items'), ...itemFields }))),
        new_items: v.optional(v.array(v.object(itemFields))),
        delete_item_ids: v.optional(v.array(v.id('invoice_items'))),
    },
    handler: async (ctx, { id, batch_name, invoice_date, status, items, new_items, delete_item_ids }) => {
        await requireInvoice(ctx, id)

        const historyPatch: Partial<Doc<'invoice_history'>> = {}
        if (batch_name !== undefined) historyPatch.batch_name = batch_name
        if (invoice_date !== undefined) historyPatch.invoice_date = invoice_date
        if (status !== undefined) historyPatch.status = status
        if (Object.keys(historyPatch).length > 0) await ctx.db.patch(id, historyPatch)

        const hasItemChanges = !!(items?.length || new_items?.length || delete_item_ids?.length)
        if (!hasItemChanges) return null

        // Item yang diubah/dihapus wajib milik invoice ini
        const ownItem = async (itemId: Id<'invoice_items'>) => {
            const item = await ctx.db.get(itemId)
            if (!item || item.history_id !== id) fail('BAD_REQUEST', 'Item tidak ditemukan di invoice ini')
            return item
        }

        for (const itemId of delete_item_ids ?? []) {
            await ownItem(itemId)
            await ctx.db.delete(itemId)
        }

        for (const { id: itemId, ...fields } of items ?? []) {
            assertValidNumbers(fields)
            const existing = await ownItem(itemId)
            // customer_name undefined = tidak diubah
            const { customer_name, ...rest } = fields
            await ctx.db.patch(existing._id, customer_name === undefined ? rest : fields)
        }

        if (new_items?.length) {
            const current = await getItems(ctx, id)
            let position = current.reduce((max, item) => Math.max(max, item.position), -1) + 1
            for (const item of new_items) {
                assertValidNumbers(item)
                await ctx.db.insert('invoice_items', {
                    ...item,
                    invoice_number: item.invoice_number || '#0001',
                    customer_name: item.customer_name ?? null,
                    history_id: id,
                    position: position++,
                })
            }
        }

        return recomputeTotals(ctx, id)
    },
})

// DELETE /api/invoices/[id]
export const remove = mutation({
    args: { id: v.id('invoice_history') },
    handler: async (ctx, { id }) => {
        await requireInvoice(ctx, id)
        await deleteWithItems(ctx, id)
    },
})

// POST /api/invoices/bulk-delete — ditolak semua kalau ada satu yang bukan miliknya
export const bulkRemove = mutation({
    args: { ids: v.array(v.id('invoice_history')) },
    handler: async (ctx, { ids }) => {
        if (ids.length === 0) fail('BAD_REQUEST', 'IDs array is required')
        for (const id of ids) await requireInvoice(ctx, id)
        for (const id of ids) await deleteWithItems(ctx, id)
        return ids.length
    },
})
