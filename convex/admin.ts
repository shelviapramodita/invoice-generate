import { getAuthUserId, invalidateSessions, modifyAccountCredentials } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalQuery, mutation, query } from './_generated/server'
import { MIN_PASSWORD_LENGTH } from './auth'
import { fail, requireAdmin, withId } from './lib/auth'
import { getConfig, serializeSubscription } from './subscriptions'

const CLEARED_BLOCK_FIELDS = {
    suspend_reason: null,
    suspended_until: null,
    suspended_by: null,
    suspended_at: null,
    ban_reason: null,
    banned_by: null,
    banned_at: null,
}

// GET /api/admin/users — semua user + langganan terakhirnya
export const listUsers = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx)
        const users = await ctx.db.query('users').order('desc').collect()
        const subs = await ctx.db.query('subscriptions').withIndex('by_created').order('desc').collect()

        const latestByUser = new Map<string, (typeof subs)[number]>()
        for (const sub of subs) {
            if (!latestByUser.has(sub.user_id)) latestByUser.set(sub.user_id, sub)
        }

        return users
            .map((user) => {
                const { legacy_id, ...profile } = withId(user)
                void legacy_id
                const sub = latestByUser.get(user._id)
                return {
                    ...profile,
                    role: user.role ?? 'user',
                    account_status: user.account_status ?? 'active',
                    // User hasil impor punya _creationTime = waktu impor, jadi
                    // urutkan dari created_at asli
                    created_at: user.created_at ?? new Date(user._creationTime).toISOString(),
                    subscription: sub ? serializeSubscription(sub) : null,
                }
            })
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
    },
})

// PATCH /api/admin/users
export const setRole = mutation({
    args: { user_id: v.id('users'), role: v.union(v.literal('admin'), v.literal('user')) },
    handler: async (ctx, { user_id, role }) => {
        await requireAdmin(ctx)
        await ctx.db.patch(user_id, { role })
    },
})

// POST /api/admin/users/actions (suspend / ban / recover)
export const setAccountStatus = mutation({
    args: {
        user_id: v.id('users'),
        action: v.union(v.literal('suspend'), v.literal('ban'), v.literal('recover')),
        reason: v.optional(v.string()),
        duration_hours: v.optional(v.number()),
    },
    handler: async (ctx, { user_id, action, reason, duration_hours }) => {
        const admin = await requireAdmin(ctx)
        if (user_id === admin._id) fail('BAD_REQUEST', 'Tidak bisa melakukan aksi pada akun sendiri')
        const now = new Date().toISOString()

        if (action === 'suspend') {
            if (!reason || !duration_hours) fail('BAD_REQUEST', 'reason and duration_hours required')
            await ctx.db.patch(user_id, {
                account_status: 'suspended',
                suspend_reason: reason,
                suspended_until: new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString(),
                suspended_by: admin._id,
                suspended_at: now,
            })
        } else if (action === 'ban') {
            if (!reason) fail('BAD_REQUEST', 'reason required')
            await ctx.db.patch(user_id, {
                ...CLEARED_BLOCK_FIELDS,
                account_status: 'banned',
                ban_reason: reason,
                banned_by: admin._id,
                banned_at: now,
            })
        } else {
            await ctx.db.patch(user_id, { ...CLEARED_BLOCK_FIELDS, account_status: 'active' })
        }
    },
})

export const passwordResetTarget = internalQuery({
    args: { admin_id: v.id('users'), user_id: v.id('users') },
    handler: async (ctx, { admin_id, user_id }) => {
        const admin = await ctx.db.get(admin_id)
        if (admin?.role !== 'admin') return null
        const user = await ctx.db.get(user_id)
        return user?.email ?? null
    },
})

// Pengganti auth.admin.updateUserById Supabase (dulu butuh service role key)
export const resetPassword = action({
    args: { user_id: v.id('users'), new_password: v.string() },
    handler: async (ctx, { user_id, new_password }) => {
        const adminId = await getAuthUserId(ctx)
        if (!adminId) fail('UNAUTHORIZED', 'Unauthorized')
        if (new_password.length < MIN_PASSWORD_LENGTH) {
            fail('BAD_REQUEST', `Password minimal ${MIN_PASSWORD_LENGTH} karakter`)
        }

        const email = await ctx.runQuery(internal.admin.passwordResetTarget, { admin_id: adminId, user_id })
        if (!email) fail('FORBIDDEN', 'Forbidden')

        await modifyAccountCredentials(ctx, { provider: 'password', account: { id: email, secret: new_password } })
        await invalidateSessions(ctx, { userId: user_id })
    },
})

// GET /api/admin/subscriptions
export const listSubscriptions = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx)
        const subs = await ctx.db.query('subscriptions').withIndex('by_created').order('desc').collect()
        return Promise.all(subs.map(async (sub) => {
            const user = await ctx.db.get(sub.user_id)
            return {
                ...serializeSubscription(sub),
                user: user ? { name: user.name ?? null, email: user.email ?? '' } : null,
            }
        }))
    },
})

// PATCH /api/admin/subscriptions
export const reviewSubscription = mutation({
    args: {
        subscription_id: v.id('subscriptions'),
        action: v.union(v.literal('approve'), v.literal('reject')),
        reject_reason: v.optional(v.string()),
    },
    handler: async (ctx, { subscription_id, action, reject_reason }) => {
        const admin = await requireAdmin(ctx)

        if (action === 'approve') {
            const config = await getConfig(ctx)
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + (config?.duration_days || 30))
            await ctx.db.patch(subscription_id, {
                status: 'active',
                approved_at: new Date().toISOString(),
                approved_by: admin._id,
                expires_at: expiresAt.toISOString(),
            })
        } else {
            await ctx.db.patch(subscription_id, {
                status: 'rejected',
                reject_reason: reject_reason || 'Bukti pembayaran tidak valid',
            })
        }
    },
})

// GET /api/admin/payment-proof — URL file bukti bayar
export const paymentProofUrl = query({
    args: { storage_id: v.id('_storage') },
    handler: async (ctx, { storage_id }) => {
        await requireAdmin(ctx)
        const url = await ctx.storage.getUrl(storage_id)
        if (!url) fail('NOT_FOUND', 'Bukti pembayaran tidak ditemukan')
        return url
    },
})

// GET /api/admin/settings
export const getSettings = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx)
        const config = await getConfig(ctx)
        return config ? withId(config) : null
    },
})

// PATCH /api/admin/settings
export const updateSettings = mutation({
    args: {
        plan_name: v.string(),
        price: v.number(),
        duration_days: v.number(),
        description: v.optional(v.union(v.string(), v.null())),
        bank_name: v.string(),
        bank_account_number: v.string(),
        bank_account_holder: v.string(),
        features: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const admin = await requireAdmin(ctx)
        const payload = { ...args, updated_by: admin._id, updated_at: new Date().toISOString() }

        const existing = await getConfig(ctx)
        if (existing) await ctx.db.patch(existing._id, payload)
        else await ctx.db.insert('subscription_config', payload)
    },
})

// GET /api/admin/login-history — 100 login terakhir
export const loginHistory = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx)
        const rows = await ctx.db.query('login_history').withIndex('by_logged_in').order('desc').take(100)
        const result = []
        for (const row of rows) {
            const user = await ctx.db.get(row.user_id)
            if (!user) continue
            result.push({ ...withId(row), profiles: { name: user.name ?? null, email: user.email ?? '' } })
        }
        return result
    },
})
