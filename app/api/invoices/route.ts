import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Pastikan route ini selalu dynamic dan tidak ter-cache di Vercel
export const dynamic = 'force-dynamic'

// GET /api/invoices - Get invoice history (filtered per user, admin sees all)
export async function GET() {
    try {
        // Validate env vars first
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            console.error('Missing Supabase env vars:', {
                hasUrl: !!supabaseUrl,
                hasKey: !!supabaseKey,
            })
            return NextResponse.json(
                {
                    error: 'Server configuration error',
                    message: 'NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum dikonfigurasi di Vercel environment variables.',
                },
                { status: 500 }
            )
        }

        const supabase = await createClient()

        // Get current user
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

        const isAdmin = profile?.role === 'admin'

        // Build query - admin sees all, user sees only their own
        let query = supabase
            .from('invoice_history')
            .select('*, invoice_items(supplier)')
            .order('created_at', { ascending: false })
            .limit(50)

        if (!isAdmin) {
            query = query.eq('user_id', user.id)
        }

        const { data, error } = await query

        if (error) {
            console.error('Supabase query error:', error)
            return NextResponse.json(
                {
                    error: 'Database error',
                    message: 'Gagal memuat data invoice',
                },
                { status: 500 }
            )
        }

        // Transform data to include suppliers array
        const historyWithSuppliers = (data as any[]).map(item => ({
            ...item,
            suppliers: Array.from(new Set(item.invoice_items?.map((i: any) => i.supplier) || [])),
        }))

        return NextResponse.json({
            success: true,
            data: historyWithSuppliers,
        })
    } catch (error: any) {
        console.error('Unexpected error:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error.message || 'Unknown error',
            },
            { status: 500 }
        )
    }
}
