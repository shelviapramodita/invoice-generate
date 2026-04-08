import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

// POST /api/admin/users/actions - Suspend, Ban, or Recover a user
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const admin = await requireAdmin(supabase)

        const body = await request.json()
        const { action, user_id, reason, duration_hours, new_password } = body

        if (!action || !user_id) {
            return NextResponse.json({ error: 'action and user_id required' }, { status: 400 })
        }

        // Don't allow actions on self
        if (user_id === admin.id) {
            return NextResponse.json({ error: 'Tidak bisa melakukan aksi pada akun sendiri' }, { status: 400 })
        }

        if (action === 'suspend') {
            if (!reason || !duration_hours) {
                return NextResponse.json({ error: 'reason and duration_hours required' }, { status: 400 })
            }

            const suspended_until = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString()

            const { error } = await supabase
                .from('profiles')
                .update({
                    account_status: 'suspended',
                    suspend_reason: reason,
                    suspended_until,
                    suspended_by: admin.id,
                    suspended_at: new Date().toISOString(),
                })
                .eq('id', user_id)

            if (error) throw error

            return NextResponse.json({ success: true, message: 'User suspended' })
        }

        if (action === 'ban') {
            if (!reason) {
                return NextResponse.json({ error: 'reason required' }, { status: 400 })
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    account_status: 'banned',
                    ban_reason: reason,
                    banned_by: admin.id,
                    banned_at: new Date().toISOString(),
                    // Clear suspend fields
                    suspend_reason: null,
                    suspended_until: null,
                    suspended_by: null,
                    suspended_at: null,
                })
                .eq('id', user_id)

            if (error) throw error

            return NextResponse.json({ success: true, message: 'User banned' })
        }

        if (action === 'recover') {
            // Recover: set status back to active, optionally reset password
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
                .eq('id', user_id)

            if (error) throw error

            // Reset password if provided (requires service role key)
            if (new_password) {
                const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

                if (serviceKey && supabaseUrl) {
                    const adminSupabase = createAdminClient(supabaseUrl, serviceKey)
                    const { error: pwError } = await adminSupabase.auth.admin.updateUserById(user_id, {
                        password: new_password,
                    })
                    if (pwError) {
                        console.error('Password reset error:', pwError)
                        return NextResponse.json({
                            success: true,
                            message: 'Akun berhasil di-recover, tapi gagal reset password: ' + pwError.message,
                        })
                    }
                }
            }

            return NextResponse.json({ success: true, message: 'User recovered' })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500 }
        )
    }
}
