import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { convexMutation, convexQuery, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

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
        const { session_id, device_info } = await request.json()

        if (!session_id) {
            return NextResponse.json({ error: 'session_id required' }, { status: 400 })
        }

        // Get IP from headers
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'Unknown'

        await convexMutation(api.users.registerSession, {
            session_id,
            device_info: device_info ? parseDevice(device_info) : 'Unknown',
            ip_address: ip,
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return errorResponse(error, 'Failed to update session')
    }
}

// GET: Check if current session is still valid
export async function GET() {
    try {
        const activeSessionId = await convexQuery(api.users.activeSession, {})
        return NextResponse.json({ success: true, active_session_id: activeSessionId })
    } catch (error) {
        return errorResponse(error)
    }
}
