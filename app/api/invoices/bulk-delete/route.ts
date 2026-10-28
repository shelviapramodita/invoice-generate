import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexMutation, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const { ids } = await request.json()

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'IDs array is required' }, { status: 400 })
        }

        const deletedCount = await convexMutation(api.invoices.bulkRemove, { ids })
        return NextResponse.json({ success: true, deletedCount })
    } catch (error) {
        return errorResponse(error, 'Failed to delete invoices')
    }
}
