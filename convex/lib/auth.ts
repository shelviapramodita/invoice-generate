import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

// Kode error yang dipetakan ke status HTTP oleh lib/convex/server.ts
export type ErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'BAD_REQUEST' | 'NOT_FOUND'

export function fail(code: ErrorCode, message: string): never {
    throw new ConvexError({ code, message })
}

// Fungsi Convex bisa dipanggil langsung dari internet, jadi setiap query dan
// mutation wajib lewat salah satu helper ini. Role selalu dibaca dari tabel
// users, tidak pernah dari input.
export async function requireUser(ctx: QueryCtx): Promise<Doc<'users'>> {
    const userId = await getAuthUserId(ctx)
    if (!userId) fail('UNAUTHORIZED', 'Unauthorized')
    const user = await ctx.db.get(userId)
    if (!user) fail('UNAUTHORIZED', 'Unauthorized')
    return user
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<'users'>> {
    const user = await requireUser(ctx)
    if (!isAdmin(user)) fail('FORBIDDEN', 'Forbidden')
    return user
}

export function isAdmin(user: Doc<'users'>) {
    return user.role === 'admin'
}

// Bentuk lama: `id` string, bukan `_id`
export function withId<T extends { _id: string; _creationTime: number }>(doc: T) {
    const { _id, _creationTime, ...rest } = doc
    void _creationTime
    return { id: _id, ...rest }
}
