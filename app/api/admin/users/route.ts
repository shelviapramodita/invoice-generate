import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Helper: check if user is admin
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

// GET /api/admin/users - List all users with subscription status
export async function GET() {
    try {
        const supabase = await createClient()
        await requireAdmin(supabase)

        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        // Get latest subscription for each user
        const userIds = profiles.map((p: any) => p.id)
        const { data: subscriptions } = await supabase
            .from('subscriptions')
            .select('*')
            .in('user_id', userIds)
            .order('created_at', { ascending: false })

        // Map latest subscription per user
        const latestSubByUser: Record<string, any> = {}
        subscriptions?.forEach((sub: any) => {
            if (!latestSubByUser[sub.user_id]) {
                latestSubByUser[sub.user_id] = sub
            }
        })

        const usersWithSubs = profiles.map((profile: any) => ({
            ...profile,
            subscription: latestSubByUser[profile.id] || null,
        }))

        return NextResponse.json({ success: true, data: usersWithSubs })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500 }
        )
    }
}

// PATCH /api/admin/users - Update user role
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient()
        await requireAdmin(supabase)

        const { user_id, role } = await request.json()

        if (!user_id || !role || !['admin', 'user'].includes(role)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        const { error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', user_id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        )
    }
}
