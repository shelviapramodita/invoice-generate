import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexAction, convexMutation, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

// POST /api/admin/users/actions - Suspend, Ban, or Recover a user
export async function POST(request: NextRequest) {
    try {
        const { action, user_id, reason, duration_hours, new_password } = await request.json()

        if (!action || !user_id || !['suspend', 'ban', 'recover'].includes(action)) {
            return NextResponse.json({ error: 'action and user_id required' }, { status: 400 })
        }

        await convexMutation(api.admin.setAccountStatus, {
            user_id,
            action,
            reason: reason || undefined,
            duration_hours: duration_hours ? Number(duration_hours) : undefined,
        })

        if (action === 'recover' && new_password) {
            try {
                await convexAction(api.admin.resetPassword, { user_id, new_password })
            } catch (pwError) {
                console.error('Password reset error:', pwError)
                return NextResponse.json({
                    success: true,
                    message: 'Akun berhasil di-recover, tapi gagal reset password',
                })
            }
        }

        const messages = { suspend: 'User suspended', ban: 'User banned', recover: 'User recovered' }
        return NextResponse.json({ success: true, message: messages[action as keyof typeof messages] })
    } catch (error) {
        return errorResponse(error)
    }
}
