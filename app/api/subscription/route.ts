import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { convexMutation, convexQuery, errorResponse } from '@/lib/convex/server'

export const dynamic = 'force-dynamic'

// GET /api/subscription - Get current user's subscription status + plan config
export async function GET() {
    try {
        const data = await convexQuery(api.subscriptions.status, {})
        return NextResponse.json({ success: true, data })
    } catch (error) {
        return errorResponse(error, 'Failed to fetch subscription')
    }
}

// POST /api/subscription - Submit new subscription (upload payment proof)
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('payment_proof') as File

        if (!file) {
            return NextResponse.json(
                { error: 'Payment proof is required' },
                { status: 400 }
            )
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Format file tidak didukung. Gunakan JPG, PNG, atau PDF.' },
                { status: 400 }
            )
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'Ukuran file maksimal 5MB' },
                { status: 400 }
            )
        }

        // Upload ke storage Convex, lalu catat pengajuannya. Mutation submit
        // mengecek ulang tipe/ukuran file dan pengajuan yang masih pending.
        const uploadUrl = await convexMutation(api.subscriptions.generateUploadUrl, {})
        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file,
        })
        if (!uploadRes.ok) {
            throw new Error(`Failed to upload: ${uploadRes.status}`)
        }
        const { storageId } = await uploadRes.json() as { storageId: Id<'_storage'> }

        const subscription = await convexMutation(api.subscriptions.submit, { payment_proof_id: storageId })

        return NextResponse.json({ success: true, data: subscription })
    } catch (error) {
        return errorResponse(error, 'Failed to submit subscription')
    }
}
