import { NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexQuery, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const history = await convexQuery(api.admin.loginHistory, {})
        return NextResponse.json({ success: true, data: history })
    } catch (error) {
        return errorResponse(error, 'Failed to fetch history')
    }
}
