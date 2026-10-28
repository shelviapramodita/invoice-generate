import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query, type QueryCtx } from './_generated/server'
import { requireUser } from './lib/auth'

export async function latestSubscription(ctx: QueryCtx, userId: Id<'users'>) {
    return ctx.db
        .query('subscriptions')
        .withIndex('by_user', (q) => q.eq('user_id', userId))
        .order('desc')
        .first()
}

export async function hasActiveSubscription(ctx: QueryCtx, userId: Id<'users'>) {
    const now = new Date().toISOString()
    const active = await ctx.db
        .query('subscriptions')
        .withIndex('by_user_status', (q) => q.eq('user_id', userId).eq('status', 'active'))
        .collect()
    return active.some((sub) => !!sub.expires_at && sub.expires_at >= now)
}

// Dipakai middleware.ts untuk gating halaman. null = belum login.
export const accessState = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx)
        if (!userId) return null
        const user = await ctx.db.get(userId)
        if (!user) return null

        const role = user.role ?? 'user'
        return {
            role,
            account_status: user.account_status ?? 'active',
            has_active_subscription: role === 'admin' ? true : await hasActiveSubscription(ctx, userId),
        }
    },
})

// GET /api/account-status
export const accountStatus = query({
    args: {},
    handler: async (ctx) => {
        const user = await requireUser(ctx)
        return {
            name: user.name ?? null,
            email: user.email ?? '',
            role: user.role ?? 'user',
            account_status: user.account_status ?? 'active',
            suspend_reason: user.suspend_reason ?? null,
            suspended_until: user.suspended_until ?? null,
            ban_reason: user.ban_reason ?? null,
        }
    },
})

// Data untuk menu user di pojok kanan atas
export const menuProfile = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx)
        if (!userId) return null
        const user = await ctx.db.get(userId)
        if (!user) return null

        const sub = await latestSubscription(ctx, userId)
        return {
            name: user.name ?? null,
            email: user.email ?? '',
            role: user.role ?? 'user',
            last_login_at: user.last_login_at ?? null,
            last_login_device: user.last_login_device ?? null,
            subscription_status: sub?.status,
            expires_at: sub?.expires_at ?? null,
        }
    },
})

// POST /api/session — dipanggil setelah login. Sesi lama di perangkat lain
// akan ter-logout oleh SessionGuard karena active_session_id berubah.
export const registerSession = mutation({
    args: { session_id: v.string(), device_info: v.string(), ip_address: v.string() },
    handler: async (ctx, args) => {
        const user = await requireUser(ctx)
        const now = new Date().toISOString()

        await ctx.db.patch(user._id, {
            active_session_id: args.session_id,
            last_login_at: now,
            last_login_device: args.device_info,
        })
        await ctx.db.insert('login_history', {
            user_id: user._id,
            device_info: args.device_info,
            ip_address: args.ip_address,
            logged_in_at: now,
        })
    },
})

// GET /api/session
export const activeSession = query({
    args: {},
    handler: async (ctx) => {
        const user = await requireUser(ctx)
        return user.active_session_id ?? null
    },
})
