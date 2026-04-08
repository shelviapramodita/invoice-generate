import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function requireAdmin(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') throw new Error('Forbidden')
    return user
}

// GET /api/admin/settings
export async function GET() {
    try {
        const supabase = await createClient()
        await requireAdmin(supabase)

        const { data, error } = await supabase
            .from('subscription_config')
            .select('*')
            .limit(1)
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH /api/admin/settings
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient()
        const admin = await requireAdmin(supabase)

        const body = await request.json()
        const {
            plan_name,
            price,
            duration_days,
            description,
            bank_name,
            bank_account_number,
            bank_account_holder,
            features,
        } = body

        const payload = {
            plan_name,
            price: parseFloat(price),
            duration_days: parseInt(duration_days),
            description,
            bank_name: bank_name || 'BCA',
            bank_account_number: bank_account_number || '',
            bank_account_holder: bank_account_holder || '',
            features: features || [],
            updated_by: admin.id,
            updated_at: new Date().toISOString(),
        }

        // Get existing config id
        const { data: existing } = await supabase
            .from('subscription_config')
            .select('id')
            .limit(1)
            .single()

        if (!existing) {
            const { error } = await supabase
                .from('subscription_config')
                .insert(payload)

            if (error) throw error
        } else {
            const { error } = await supabase
                .from('subscription_config')
                .update(payload)
                .eq('id', existing.id)

            if (error) throw error
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
