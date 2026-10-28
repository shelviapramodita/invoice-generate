import { NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexQuery, errorResponse } from '@/lib/convex/server'

// Pastikan route ini selalu dynamic dan tidak ter-cache di Vercel
export const dynamic = 'force-dynamic'

// GET /api/invoices - Get invoice history (filtered per user, admin sees all)
export async function GET() {
    try {
        const data = await convexQuery(api.invoices.list, {})
        return NextResponse.json({ success: true, data })
    } catch (error) {
        return errorResponse(error, 'Gagal memuat data invoice')
    }
}
