import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexMutation, convexQuery, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

// GET /api/admin/subscriptions - List all subscriptions
export async function GET() {
    try {
        const data = await convexQuery(api.admin.listSubscriptions, {})
        return NextResponse.json({ success: true, data })
    } catch (error) {
        return errorResponse(error)
    }
}

// PATCH /api/admin/subscriptions - Approve or reject subscription
export async function PATCH(request: NextRequest) {
    try {
        const { subscription_id, action, reject_reason } = await request.json()

        if (!subscription_id || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        await convexMutation(api.admin.reviewSubscription, {
            subscription_id,
            action,
            reject_reason: reject_reason || undefined,
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return errorResponse(error)
    }
}
