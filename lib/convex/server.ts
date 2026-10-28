import 'server-only'
import { NextResponse } from 'next/server'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'
import { fetchAction, fetchMutation, fetchQuery } from 'convex/nextjs'
import { ConvexError } from 'convex/values'
import type { FunctionReference, FunctionReturnType } from 'convex/server'

// Pemanggil fungsi Convex dari Route Handler, atas nama user yang login
// (token diambil dari cookie Convex Auth). Pengecekan hak akses ada di
// fungsi Convex-nya sendiri (convex/lib/auth.ts).

type Fn<T extends 'query' | 'mutation' | 'action'> = FunctionReference<T, 'public'>

export async function convexQuery<F extends Fn<'query'>>(fn: F, args: F['_args']): Promise<FunctionReturnType<F>> {
    return fetchQuery(fn, args, { token: await convexAuthNextjsToken() })
}

export async function convexMutation<F extends Fn<'mutation'>>(fn: F, args: F['_args']): Promise<FunctionReturnType<F>> {
    return fetchMutation(fn, args, { token: await convexAuthNextjsToken() })
}

export async function convexAction<F extends Fn<'action'>>(fn: F, args: F['_args']): Promise<FunctionReturnType<F>> {
    return fetchAction(fn, args, { token: await convexAuthNextjsToken() })
}

const STATUS_BY_CODE: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
}

/**
 * Ubah error dari fungsi Convex (`fail()` di convex/lib/auth.ts) jadi respons
 * `{ error }` dengan status yang sesuai. Error lain → 500 dengan `fallback`.
 */
export function errorResponse(error: unknown, fallback = 'Internal server error') {
    if (error instanceof ConvexError && typeof error.data === 'object' && error.data !== null) {
        const { code, message } = error.data as { code?: string; message?: string }
        if (code && STATUS_BY_CODE[code]) {
            return NextResponse.json({ error: message ?? code }, { status: STATUS_BY_CODE[code] })
        }
    }
    console.error(fallback, error)
    return NextResponse.json({ error: fallback }, { status: 500 })
}
