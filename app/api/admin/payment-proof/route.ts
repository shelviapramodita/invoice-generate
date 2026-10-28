import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { convexQuery, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

// `path` = payment_proof_url dari /api/admin/subscriptions (id file Convex)
export async function GET(request: NextRequest) {
    try {
        const path = request.nextUrl.searchParams.get('path')
        if (!path) {
            return NextResponse.json({ error: 'Path required' }, { status: 400 })
        }

        const url = await convexQuery(api.admin.paymentProofUrl, { storage_id: path as Id<'_storage'> })
        return NextResponse.json({ success: true, url })
    } catch (error) {
        return errorResponse(error, 'Failed to create signed URL')
    }
}
