import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Parse user agent into readable device info
function parseDevice(ua: string): string {
    // Browser
    let browser = 'Unknown Browser'
    if (ua.includes('Firefox/')) browser = 'Firefox'
    else if (ua.includes('Edg/')) browser = 'Edge'
    else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome'
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari'
    else if (ua.includes('Opera/') || ua.includes('OPR/')) browser = 'Opera'

    // OS
    let os = 'Unknown OS'
    if (ua.includes('Windows NT')) os = 'Windows'
    else if (ua.includes('Mac OS X')) os = 'macOS'
    else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

    return `${browser} - ${os}`
}

// POST: Register a new session (called on login)
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { session_id, device_info } = await request.json()

        if (!session_id) {
            return NextResponse.json({ error: 'session_id required' }, { status: 400 })
        }

        const deviceParsed = device_info ? parseDevice(device_info) : 'Unknown'
        const now = new Date().toISOString()

        // Get IP from headers
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'Unknown'

        // Update profile: active session + last login info
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                active_session_id: session_id,
                last_login_at: now,
                last_login_device: deviceParsed,
            })
            .eq('id', user.id)

        if (profileError) {
            console.error('Error updating session:', profileError)
            return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
        }

        // Insert login history
        const { error: historyError } = await supabase
            .from('login_history')
            .insert({
                user_id: user.id,
                device_info: deviceParsed,
                ip_address: ip,
            })

        if (historyError) {
            console.error('Error inserting login history:', historyError)
            // Non-critical, don't fail the request
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Session POST error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET: Check if current session is still valid
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('active_session_id')
            .eq('id', user.id)
            .single()

        return NextResponse.json({
            success: true,
            active_session_id: profile?.active_session_id || null,
        })
    } catch (error) {
        console.error('Session GET error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
