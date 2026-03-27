import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Pastikan route ini selalu dynamic dan tidak ter-cache di Vercel
export const dynamic = 'force-dynamic'

// GET /api/invoices - Get all invoice history
export async function GET() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('invoice_history')
            .select('*, invoice_items(supplier)')
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            console.error('[API] Error fetching invoice history:', error)
            return NextResponse.json(
                {
                    error: 'Failed to fetch invoice history',
                    message: error.message,
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
        console.error('[API] Error fetching invoice history:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch invoice history',
                message: error.message || 'Unknown error',
            },
            { status: 500 }
        )
    }
}
