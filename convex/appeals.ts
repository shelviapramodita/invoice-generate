import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { fail, isAdmin, requireAdmin, requireUser, withId } from './lib/auth'

// GET /api/appeals — admin melihat semua, user hanya miliknya
export const list = query({
    args: {},
    handler: async (ctx) => {
        const user = await requireUser(ctx)

        if (isAdmin(user)) {
            const appeals = await ctx.db.query('appeals').withIndex('by_created').order('desc').collect()
            return Promise.all(appeals.map(async (appeal) => {
                const owner = await ctx.db.get(appeal.user_id)
                return {
                    ...withId(appeal),
                    profiles: owner ? { name: owner.name ?? null, email: owner.email ?? '' } : null,
                }
            }))
        }

        const appeals = await ctx.db
            .query('appeals')
            .withIndex('by_user', (q) => q.eq('user_id', user._id))
            .order('desc')
            .collect()
        return appeals.map(withId)
    },
})

// POST /api/appeals
export const submit = mutation({
    args: { message: v.string() },
    handler: async (ctx, { message }) => {
        const user = await requireUser(ctx)
        const status = user.account_status
        if (status !== 'suspended' && status !== 'banned') {
            fail('BAD_REQUEST', 'Akun Anda tidak dalam status suspended/banned')
        }

        const pending = await ctx.db
            .query('appeals')
            .withIndex('by_user_status', (q) => q.eq('user_id', user._id).eq('status', 'pending'))
            .first()
        if (pending) fail('BAD_REQUEST', 'Anda sudah memiliki banding yang sedang diproses')

        if (message.trim().length < 10) fail('BAD_REQUEST', 'Pesan banding minimal 10 karakter')

        const id = await ctx.db.insert('appeals', {
            user_id: user._id,
            appeal_type: status,
            message: message.trim(),
            status: 'pending',
            created_at: new Date().toISOString(),
        })
        return withId((await ctx.db.get(id))!)
    },
})

// PATCH /api/appeals — admin menjawab; kalau disetujui, akun dipulihkan
export const respond = mutation({
    args: {
        appeal_id: v.id('appeals'),
        status: v.union(v.literal('approved'), v.literal('rejected')),
        admin_response: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, { appeal_id, status, admin_response }) => {
        const admin = await requireAdmin(ctx)
        const appeal = await ctx.db.get(appeal_id)
        if (!appeal) fail('NOT_FOUND', 'Banding tidak ditemukan')

        await ctx.db.patch(appeal_id, {
            status,
            admin_response: admin_response || null,
            responded_by: admin._id,
            responded_at: new Date().toISOString(),
        })

        if (status === 'approved') {
            await ctx.db.patch(appeal.user_id, {
                account_status: 'active',
                suspend_reason: null,
                suspended_until: null,
                suspended_by: null,
                suspended_at: null,
                ban_reason: null,
                banned_by: null,
                banned_at: null,
            })
        }
    },
})
