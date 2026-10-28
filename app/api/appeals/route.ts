import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexMutation, convexQuery, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

// GET /api/appeals - Get current user's appeal or admin gets all appeals
export async function GET() {
    try {
        const appeals = await convexQuery(api.appeals.list, {})
        return NextResponse.json({ success: true, data: appeals })
    } catch (error) {
        return errorResponse(error)
    }
}

// POST /api/appeals - User submits an appeal
export async function POST(request: NextRequest) {
    try {
        const { message } = await request.json()
        if (typeof message !== 'string') {
            return NextResponse.json({ error: 'Pesan banding minimal 10 karakter' }, { status: 400 })
        }

        const appeal = await convexMutation(api.appeals.submit, { message })
        return NextResponse.json({ success: true, data: appeal })
    } catch (error) {
        return errorResponse(error)
    }
}

// PATCH /api/appeals - Admin responds to an appeal
export async function PATCH(request: NextRequest) {
    try {
        const { appeal_id, status, admin_response } = await request.json()

        if (!appeal_id || !status || !['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        await convexMutation(api.appeals.respond, { appeal_id, status, admin_response: admin_response || null })
        return NextResponse.json({ success: true })
    } catch (error) {
        return errorResponse(error)
    }
}
