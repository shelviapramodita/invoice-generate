import { v } from 'convex/values'
import { internalMutation, internalQuery, type MutationCtx } from './_generated/server'

// Impor satu kali dari Supabase (scripts/import-to-convex.mjs). Semua fungsi
// internal: hanya bisa dipanggil lewat `npx convex run`, tidak dari internet.
// Idempotent: baris yang legacy_id-nya sudah ada dilewati, jadi aman diulang.

const str = v.optional(v.union(v.string(), v.null()))

async function userIdByLegacy(ctx: MutationCtx, legacyId: string | null | undefined) {
    if (!legacyId) return null
    const user = await ctx.db
        .query('users')
        .withIndex('by_legacy_id', (q) => q.eq('legacy_id', legacyId))
        .first()
    return user?._id ?? null
}

type Result = { inserted: number; skipped: number; missing_user: number }
const emptyResult = (): Result => ({ inserted: 0, skipped: 0, missing_user: 0 })

export const importUsers = internalMutation({
    args: {
        rows: v.array(v.object({
            legacy_id: v.string(),
            email: v.string(),
            name: str,
            // Hash bcrypt dari auth.users.encrypted_password
            password_hash: str,
            role: v.union(v.literal('admin'), v.literal('user')),
            account_status: v.union(v.literal('active'), v.literal('suspended'), v.literal('banned')),
            suspend_reason: str,
            suspended_until: str,
            suspended_at: str,
            ban_reason: str,
            banned_at: str,
            last_login_at: str,
            last_login_device: str,
            created_at: v.string(),
        })),
    },
    handler: async (ctx, { rows }) => {
        const result = emptyResult()
        for (const { password_hash, name, ...row } of rows) {
            if (await userIdByLegacy(ctx, row.legacy_id)) {
                result.skipped++
                continue
            }

            // Email sudah terdaftar di Convex (misal akun tes) → cukup tandai
            // legacy_id-nya supaya relasi data lama nyambung ke akun itu
            const existing = await ctx.db
                .query('users')
                .withIndex('email', (q) => q.eq('email', row.email))
                .first()
            if (existing) {
                await ctx.db.patch(existing._id, { legacy_id: row.legacy_id })
                result.skipped++
                continue
            }

            const userId = await ctx.db.insert('users', { ...row, ...(name ? { name } : {}) })
            if (password_hash) {
                await ctx.db.insert('authAccounts', {
                    userId,
                    provider: 'password',
                    providerAccountId: row.email,
                    secret: password_hash,
                })
            }
            result.inserted++
        }
        return result
    },
})

export const importSubscriptions = internalMutation({
    args: {
        rows: v.array(v.object({
            legacy_id: v.string(),
            user_legacy_id: v.string(),
            status: v.union(v.literal('pending'), v.literal('active'), v.literal('rejected'), v.literal('expired')),
            legacy_payment_proof_path: str,
            submitted_at: str,
            approved_at: str,
            approved_by_legacy_id: str,
            expires_at: str,
            reject_reason: str,
            created_at: v.string(),
        })),
    },
    handler: async (ctx, { rows }) => {
        const result = emptyResult()
        for (const { user_legacy_id, approved_by_legacy_id, legacy_payment_proof_path, ...row } of rows) {
            const existing = await ctx.db
                .query('subscriptions')
                .withIndex('by_legacy_id', (q) => q.eq('legacy_id', row.legacy_id))
                .first()
            if (existing) {
                result.skipped++
                continue
            }
            const userId = await userIdByLegacy(ctx, user_legacy_id)
            if (!userId) {
                result.missing_user++
                continue
            }
            await ctx.db.insert('subscriptions', {
                ...row,
                user_id: userId,
                approved_by: await userIdByLegacy(ctx, approved_by_legacy_id),
                ...(legacy_payment_proof_path ? { legacy_payment_proof_path } : {}),
            })
            result.inserted++
        }
        return result
    },
})

export const importConfig = internalMutation({
    args: {
        row: v.object({
            plan_name: v.string(),
            price: v.number(),
            duration_days: v.number(),
            description: str,
            bank_name: v.string(),
            bank_account_number: v.string(),
            bank_account_holder: v.string(),
            features: v.array(v.string()),
            updated_at: str,
        }),
    },
    handler: async (ctx, { row }) => {
        if (await ctx.db.query('subscription_config').first()) return emptyResult()
        await ctx.db.insert('subscription_config', row)
        return { ...emptyResult(), inserted: 1 }
    },
})

export const importAppeals = internalMutation({
    args: {
        rows: v.array(v.object({
            legacy_id: v.string(),
            user_legacy_id: v.string(),
            appeal_type: v.string(),
            message: v.string(),
            status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected')),
            admin_response: str,
            responded_by_legacy_id: str,
            responded_at: str,
            created_at: v.string(),
        })),
    },
    handler: async (ctx, { rows }) => {
        const result = emptyResult()
        for (const { user_legacy_id, responded_by_legacy_id, ...row } of rows) {
            const existing = await ctx.db
                .query('appeals')
                .withIndex('by_legacy_id', (q) => q.eq('legacy_id', row.legacy_id))
                .first()
            if (existing) {
                result.skipped++
                continue
            }
            const userId = await userIdByLegacy(ctx, user_legacy_id)
            if (!userId) {
                result.missing_user++
                continue
            }
            await ctx.db.insert('appeals', {
                ...row,
                user_id: userId,
                responded_by: await userIdByLegacy(ctx, responded_by_legacy_id),
            })
            result.inserted++
        }
        return result
    },
})

export const importLoginHistory = internalMutation({
    args: {
        rows: v.array(v.object({
            legacy_id: v.string(),
            user_legacy_id: v.string(),
            device_info: v.string(),
            ip_address: v.string(),
            logged_in_at: v.string(),
        })),
    },
    handler: async (ctx, { rows }) => {
        const result = emptyResult()
        for (const { user_legacy_id, ...row } of rows) {
            const existing = await ctx.db
                .query('login_history')
                .withIndex('by_legacy_id', (q) => q.eq('legacy_id', row.legacy_id))
                .first()
            if (existing) {
                result.skipped++
                continue
            }
            const userId = await userIdByLegacy(ctx, user_legacy_id)
            if (!userId) {
                result.missing_user++
                continue
            }
            await ctx.db.insert('login_history', { ...row, user_id: userId })
            result.inserted++
        }
        return result
    },
})

// Satu riwayat + semua itemnya dalam satu transaksi, jadi tidak pernah ada
// riwayat setengah terimpor. Urutan items = urutan baris asli di Supabase.
export const importInvoiceHistory = internalMutation({
    args: {
        rows: v.array(v.object({
            legacy_id: v.string(),
            user_legacy_id: v.string(),
            batch_name: str,
            invoice_date: v.string(),
            status: v.union(v.literal('generated'), v.literal('completed')),
            created_at: v.string(),
            items: v.array(v.object({
                supplier: v.string(),
                invoice_number: v.string(),
                item_name: v.string(),
                quantity: v.number(),
                unit: v.string(),
                price: v.number(),
                total: v.number(),
                customer_name: str,
            })),
        })),
    },
    handler: async (ctx, { rows }) => {
        const result = emptyResult()
        for (const { user_legacy_id, items, ...row } of rows) {
            const existing = await ctx.db
                .query('invoice_history')
                .withIndex('by_legacy_id', (q) => q.eq('legacy_id', row.legacy_id))
                .first()
            if (existing) {
                result.skipped++
                continue
            }
            const userId = await userIdByLegacy(ctx, user_legacy_id)
            if (!userId) {
                result.missing_user++
                continue
            }

            const suppliers = Array.from(new Set(items.map((item) => item.supplier)))
            const historyId = await ctx.db.insert('invoice_history', {
                ...row,
                user_id: userId,
                total_suppliers: suppliers.length,
                total_items: items.length,
                grand_total: items.reduce((sum, item) => sum + item.total, 0),
                suppliers,
            })
            for (const [position, item] of items.entries()) {
                await ctx.db.insert('invoice_items', { ...item, history_id: historyId, position })
            }
            result.inserted++
        }
        return result
    },
})

// Jumlah dokumen per tabel, untuk dicocokkan dengan jumlah baris di Supabase
export const counts = internalQuery({
    args: {},
    handler: async (ctx) => {
        const tables = ['users', 'authAccounts', 'subscriptions', 'subscription_config', 'appeals',
            'login_history'] as const
        const result: Record<string, number> = {}
        for (const table of tables) result[table] = (await ctx.db.query(table).collect()).length

        // invoice_items terlalu banyak untuk dibaca dalam satu query, jadi
        // dihitung dari total_items tiap riwayat
        const histories = await ctx.db.query('invoice_history').collect()
        result.invoice_history = histories.length
        result.invoice_items = histories.reduce((sum, h) => sum + h.total_items, 0)
        return result
    },
})
