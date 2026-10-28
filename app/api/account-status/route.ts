import { NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexQuery, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

// GET /api/account-status - Get current user's account status
export async function GET() {
    try {
        const data = await convexQuery(api.users.accountStatus, {})
        return NextResponse.json({ success: true, data })
    } catch (error) {
        return errorResponse(error)
    }
}
