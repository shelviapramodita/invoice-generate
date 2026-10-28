import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexMutation, convexQuery, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

// GET /api/admin/settings
export async function GET() {
    try {
        const data = await convexQuery(api.admin.getSettings, {})
        return NextResponse.json({ success: true, data })
    } catch (error) {
        return errorResponse(error)
    }
}

// PATCH /api/admin/settings
export async function PATCH(request: NextRequest) {
    try {
        const {
            plan_name,
            price,
            duration_days,
            description,
            bank_name,
            bank_account_number,
            bank_account_holder,
            features,
        } = await request.json()

        const parsedPrice = parseFloat(price)
        const parsedDuration = parseInt(duration_days)
        if (!plan_name || isNaN(parsedPrice) || isNaN(parsedDuration)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        await convexMutation(api.admin.updateSettings, {
            plan_name,
            price: parsedPrice,
            duration_days: parsedDuration,
            description: description ?? null,
            bank_name: bank_name || 'BCA',
            bank_account_number: bank_account_number || '',
            bank_account_holder: bank_account_holder || '',
            features: Array.isArray(features) ? features : [],
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return errorResponse(error)
    }
}
