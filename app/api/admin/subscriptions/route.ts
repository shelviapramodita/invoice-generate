import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function requireAdmin(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') throw new Error('Forbidden')
    return user
}

// GET /api/admin/subscriptions - List all subscriptions
export async function GET() {
    try {
        const supabase = await createClient()
        await requireAdmin(supabase)

        const { data, error } = await supabase
            .from('subscriptions')
            .select(`
                *,
                user:profiles!subscriptions_user_id_fkey(name, email)
            `)
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        )
    }
}

// PATCH /api/admin/subscriptions - Approve or reject subscription
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient()
        const admin = await requireAdmin(supabase)

        const { subscription_id, action, reject_reason } = await request.json()

        if (!subscription_id || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        if (action === 'approve') {
            // Get plan config for duration
            const { data: config } = await supabase
                .from('subscription_config')
                .select('duration_days')
                .limit(1)
                .single()

            const durationDays = config?.duration_days || 30
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + durationDays)

            const { error } = await supabase
                .from('subscriptions')
                .update({
                    status: 'active',
                    approved_at: new Date().toISOString(),
                    approved_by: admin.id,
                    expires_at: expiresAt.toISOString(),
                })
                .eq('id', subscription_id)

            if (error) throw error
        } else {
            const { error } = await supabase
                .from('subscriptions')
                .update({
                    status: 'rejected',
                    reject_reason: reject_reason || 'Bukti pembayaran tidak valid',
                })
                .eq('id', subscription_id)

            if (error) throw error
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        )
    }
}
