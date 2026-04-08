import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const path = request.nextUrl.searchParams.get('path')
        if (!path) {
            return NextResponse.json({ error: 'Path required' }, { status: 400 })
        }

        // Prevent path traversal
        if (path.includes('..') || path.startsWith('/')) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
        }

        const { data, error } = await supabase.storage
            .from('payment-proofs')
            .createSignedUrl(path, 300)

        if (error) {
            console.error('Signed URL error:', error)
            return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
        }

        return NextResponse.json({ success: true, url: data.signedUrl })
    } catch (error) {
        console.error('Payment proof error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
