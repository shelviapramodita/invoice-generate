import { NextRequest, NextResponse } from 'next/server'
import { bulkDeleteInvoiceHistory } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
        const isAdmin = profile?.role === 'admin'

        const body = await request.json()
        const { ids } = body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'IDs array is required' }, { status: 400 })
        }

        if (!isAdmin) {
            const { data: invoices } = await supabase
                .from('invoice_history')
                .select('id, user_id')
                .in('id', ids)

            const unauthorized = invoices?.some(inv => inv.user_id !== user.id)
            if (unauthorized) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        const result = await bulkDeleteInvoiceHistory(ids)

        return NextResponse.json({
            success: true,
            deletedCount: result.deletedCount,
        })
    } catch (error: any) {
        console.error('Error bulk deleting invoices:', error)
        return NextResponse.json({ error: 'Failed to delete invoices' }, { status: 500 })
    }
}
