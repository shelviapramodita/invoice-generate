import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/account-status - Get current user's account status
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('name, email, role, account_status, suspend_reason, suspended_until, ban_reason')
            .eq('id', user.id)
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data: profile })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
