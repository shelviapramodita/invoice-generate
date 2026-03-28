import { NextRequest, NextResponse } from 'next/server'
import { bulkDeleteInvoiceHistory } from '@/lib/db/queries'

// POST /api/invoices/bulk-delete - Bulk delete invoices
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { ids } = body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                {
                    error: 'Invalid request',
                    message: 'IDs array is required and must not be empty',
                },
                { status: 400 }
            )
        }

        console.log(`[API] Bulk deleting ${ids.length} invoices...`)

        const result = await bulkDeleteInvoiceHistory(ids)

        console.log(`[API] ✅ Successfully deleted ${result.deletedCount} invoices`)

        return NextResponse.json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} invoices`,
            deletedCount: result.deletedCount,
        })
    } catch (error: any) {
        console.error('[API] Error bulk deleting invoices:', error)
        return NextResponse.json(
            {
                error: 'Failed to delete invoices',
                message: error.message || 'Unknown error',
            },
            { status: 500 }
        )
    }
}
