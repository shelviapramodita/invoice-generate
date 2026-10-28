import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexMutation, convexQuery, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

// GET /api/admin/users - List all users with subscription status
export async function GET() {
    try {
        const users = await convexQuery(api.admin.listUsers, {})
        return NextResponse.json({ success: true, data: users })
    } catch (error) {
        return errorResponse(error)
    }
}

// PATCH /api/admin/users - Update user role
export async function PATCH(request: NextRequest) {
    try {
        const { user_id, role } = await request.json()

        if (!user_id || !role || !['admin', 'user'].includes(role)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        await convexMutation(api.admin.setRole, { user_id, role })
        return NextResponse.json({ success: true })
    } catch (error) {
        return errorResponse(error)
    }
}
