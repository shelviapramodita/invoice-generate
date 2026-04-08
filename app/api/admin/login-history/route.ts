import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Get login history with user info
        const { data: history, error } = await supabase
            .from('login_history')
            .select(`
                id,
                user_id,
                device_info,
                ip_address,
                logged_in_at,
                profiles!inner(name, email)
            `)
            .order('logged_in_at', { ascending: false })
            .limit(100)

        if (error) {
            console.error('Error fetching login history:', error)
            return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
        }

        return NextResponse.json({ success: true, data: history })
    } catch (error) {
        console.error('Login history error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
