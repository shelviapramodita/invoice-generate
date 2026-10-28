import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { mutation, query, type QueryCtx } from './_generated/server'
import { fail, requireUser, withId } from './lib/auth'
import { latestSubscription } from './users'

const ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_PROOF_SIZE = 5 * 1024 * 1024

export async function getConfig(ctx: QueryCtx) {
    return ctx.db.query('subscription_config').first()
}

// Bentuk lama: payment_proof_url = id file yang dikirim balik ke
// /api/admin/payment-proof?path=... untuk minta URL-nya
export function serializeSubscription(sub: Doc<'subscriptions'>) {
    const { payment_proof_id, legacy_payment_proof_path, legacy_id, ...rest } = withId(sub)
    void legacy_payment_proof_path
    void legacy_id
    return { ...rest, payment_proof_url: payment_proof_id ?? null }
}

// GET /api/subscription
export const status = query({
    args: {},
    handler: async (ctx) => {
        const user = await requireUser(ctx)
        const config = await getConfig(ctx)
        const subscription = await latestSubscription(ctx, user._id)
        const { legacy_id, ...profile } = withId(user)
        void legacy_id
        return {
            config: config ? withId(config) : null,
            subscription: subscription ? serializeSubscription(subscription) : null,
            profile,
        }
    },
})

export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        await requireUser(ctx)
        return ctx.storage.generateUploadUrl()
    },
})

// POST /api/subscription — setelah bukti bayar di-upload ke storage Convex
export const submit = mutation({
    args: { payment_proof_id: v.id('_storage') },
    handler: async (ctx, { payment_proof_id }) => {
        const user = await requireUser(ctx)

        // Cek ulang di server: file bisa di-upload langsung tanpa lewat route
        const file = await ctx.db.system.get(payment_proof_id)
        if (!file) fail('BAD_REQUEST', 'Payment proof is required')
        if (!file.contentType || !ALLOWED_PROOF_TYPES.includes(file.contentType) || file.size > MAX_PROOF_SIZE) {
            await ctx.storage.delete(payment_proof_id)
            fail('BAD_REQUEST', 'Format file tidak didukung atau ukuran lebih dari 5MB')
        }

        const pending = await ctx.db
            .query('subscriptions')
            .withIndex('by_user_status', (q) => q.eq('user_id', user._id).eq('status', 'pending'))
            .first()
        if (pending) {
            await ctx.storage.delete(payment_proof_id)
            fail('BAD_REQUEST', 'Anda sudah memiliki pengajuan yang sedang diproses')
        }

        const now = new Date().toISOString()
        const id = await ctx.db.insert('subscriptions', {
            user_id: user._id,
            status: 'pending',
            payment_proof_id,
            submitted_at: now,
            created_at: now,
        })
        return serializeSubscription((await ctx.db.get(id))!)
    },
})
