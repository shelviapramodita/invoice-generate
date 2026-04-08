import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/appeals - Get current user's appeal or admin gets all appeals
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role === 'admin') {
            // Admin: get all appeals
            const { data: appeals, error } = await supabase
                .from('appeals')
                .select('*, profiles!appeals_user_id_fkey(name, email)')
                .order('created_at', { ascending: false })

            if (error) throw error

            return NextResponse.json({ success: true, data: appeals })
        } else {
            // User: get own appeals
            const { data: appeals, error } = await supabase
                .from('appeals')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            return NextResponse.json({ success: true, data: appeals })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST /api/appeals - User submits an appeal
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check account status
        const { data: profile } = await supabase
            .from('profiles')
            .select('account_status')
            .eq('id', user.id)
            .single()

        if (!profile || (profile.account_status !== 'suspended' && profile.account_status !== 'banned')) {
            return NextResponse.json({ error: 'Akun Anda tidak dalam status suspended/banned' }, { status: 400 })
        }

        // Check if already has pending appeal
        const { data: existing } = await supabase
            .from('appeals')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .limit(1)
            .single()

        if (existing) {
            return NextResponse.json({ error: 'Anda sudah memiliki banding yang sedang diproses' }, { status: 400 })
        }

        const body = await request.json()
        const { message } = body

        if (!message || message.trim().length < 10) {
            return NextResponse.json({ error: 'Pesan banding minimal 10 karakter' }, { status: 400 })
        }

        const { data: appeal, error } = await supabase
            .from('appeals')
            .insert({
                user_id: user.id,
                appeal_type: profile.account_status,
                message: message.trim(),
                status: 'pending',
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data: appeal })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH /api/appeals - Admin responds to an appeal
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { appeal_id, status, admin_response } = body

        if (!appeal_id || !status || !['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        // Update appeal
        const { error: appealError } = await supabase
            .from('appeals')
            .update({
                status,
                admin_response: admin_response || null,
                responded_by: user.id,
                responded_at: new Date().toISOString(),
            })
            .eq('id', appeal_id)

        if (appealError) throw appealError

        // If approved, recover the user's account
        if (status === 'approved') {
            const { data: appeal } = await supabase
                .from('appeals')
                .select('user_id')
                .eq('id', appeal_id)
                .single()

            if (appeal) {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        account_status: 'active',
                        suspend_reason: null,
                        suspended_until: null,
                        suspended_by: null,
                        suspended_at: null,
                        ban_reason: null,
                        banned_by: null,
                        banned_at: null,
                    })
                    .eq('id', appeal.user_id)

                if (error) throw error
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
