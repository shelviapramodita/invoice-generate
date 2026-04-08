import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/subscription - Get current user's subscription status + plan config
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get plan config
        const { data: config } = await supabase
            .from('subscription_config')
            .select('*')
            .limit(1)
            .single()

        // Get user's latest subscription
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        // Get user profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        return NextResponse.json({
            success: true,
            data: { config, subscription, profile },
        })
    } catch (error: any) {
        console.error('Subscription error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch subscription', message: error.message },
            { status: 500 }
        )
    }
}

// POST /api/subscription - Submit new subscription (upload payment proof)
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

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

        // Check if user already has a pending subscription
        const { data: existing } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .limit(1)
            .single()

        if (existing) {
            return NextResponse.json(
                { error: 'Anda sudah memiliki pengajuan yang sedang diproses' },
                { status: 400 }
            )
        }

        // Upload payment proof
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        const buffer = Buffer.from(await file.arrayBuffer())

        const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: false,
            })

        if (uploadError) {
            console.error('Upload error:', uploadError)
            throw new Error(`Failed to upload: ${uploadError.message}`)
        }

        // Create subscription record
        const { data: subscription, error: insertError } = await supabase
            .from('subscriptions')
            .insert({
                user_id: user.id,
                status: 'pending',
                payment_proof_url: fileName,
                submitted_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (insertError) {
            console.error('Insert error:', insertError)
            throw new Error(`Failed to create subscription: ${insertError.message}`)
        }

        return NextResponse.json({ success: true, data: subscription })
    } catch (error: any) {
        console.error('Subscription error:', error)
        return NextResponse.json(
            { error: 'Failed to submit subscription', message: error.message },
            { status: 500 }
        )
    }
}
