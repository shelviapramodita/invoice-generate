import { defineSchema, defineTable } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'
import { v, type Validator } from 'convex/values'

// Nama kolom sengaja tetap snake_case dan waktu disimpan sebagai string ISO,
// sama seperti tabel Supabase lama, supaya bentuk respons /api/* tidak
// berubah dan data hasil ekspor bisa diimpor apa adanya.
const nullable = <T>(validator: Validator<T, 'required', string>) =>
    v.optional(v.union(validator, v.null()))

export default defineSchema({
    ...authTables,

    // Tabel users bawaan Convex Auth + isi tabel profiles lama
    users: defineTable({
        name: v.optional(v.string()),
        image: v.optional(v.string()),
        email: v.optional(v.string()),
        emailVerificationTime: v.optional(v.number()),
        phone: v.optional(v.string()),
        phoneVerificationTime: v.optional(v.number()),
        isAnonymous: v.optional(v.boolean()),

        role: v.optional(v.union(v.literal('admin'), v.literal('user'))),
        account_status: v.optional(v.union(v.literal('active'), v.literal('suspended'), v.literal('banned'))),
        suspend_reason: nullable(v.string()),
        suspended_until: nullable(v.string()),
        suspended_by: nullable(v.id('users')),
        suspended_at: nullable(v.string()),
        ban_reason: nullable(v.string()),
        banned_by: nullable(v.id('users')),
        banned_at: nullable(v.string()),
        active_session_id: nullable(v.string()),
        last_login_at: nullable(v.string()),
        last_login_device: nullable(v.string()),
        created_at: v.optional(v.string()),
        // UUID dari Supabase, untuk memetakan relasi saat impor data lama
        legacy_id: v.optional(v.string()),
    })
        .index('email', ['email'])
        .index('phone', ['phone'])
        .index('by_legacy_id', ['legacy_id']),

    subscriptions: defineTable({
        user_id: v.id('users'),
        status: v.union(v.literal('pending'), v.literal('active'), v.literal('rejected'), v.literal('expired')),
        payment_proof_id: v.optional(v.id('_storage')),
        // Path file di bucket payment-proofs Supabase; filenya tidak ikut pindah
        legacy_payment_proof_path: v.optional(v.string()),
        submitted_at: nullable(v.string()),
        approved_at: nullable(v.string()),
        approved_by: nullable(v.id('users')),
        expires_at: nullable(v.string()),
        reject_reason: nullable(v.string()),
        created_at: v.string(),
        legacy_id: v.optional(v.string()),
    })
        .index('by_user', ['user_id', 'created_at'])
        .index('by_user_status', ['user_id', 'status'])
        .index('by_created', ['created_at'])
        .index('by_legacy_id', ['legacy_id']),

    // Satu baris saja (singleton)
    subscription_config: defineTable({
        plan_name: v.string(),
        price: v.number(),
        duration_days: v.number(),
        description: nullable(v.string()),
        bank_name: v.string(),
        bank_account_number: v.string(),
        bank_account_holder: v.string(),
        features: v.array(v.string()),
        updated_by: nullable(v.id('users')),
        updated_at: nullable(v.string()),
    }),

    invoice_history: defineTable({
        user_id: v.id('users'),
        batch_name: nullable(v.string()),
        invoice_date: v.string(),
        total_suppliers: v.number(),
        total_items: v.number(),
        grand_total: v.number(),
        // Disimpan di sini supaya daftar riwayat tidak perlu membaca semua item
        suppliers: v.array(v.string()),
        status: v.union(v.literal('generated'), v.literal('completed')),
        created_at: v.string(),
        legacy_id: v.optional(v.string()),
    })
        .index('by_created', ['created_at'])
        .index('by_user', ['user_id', 'created_at'])
        .index('by_legacy_id', ['legacy_id']),

    invoice_items: defineTable({
        history_id: v.id('invoice_history'),
        supplier: v.string(),
        invoice_number: v.string(),
        item_name: v.string(),
        quantity: v.number(),
        unit: v.string(),
        price: v.number(),
        total: v.number(),
        customer_name: nullable(v.string()),
        // Urutan baris di Excel, supaya PDF yang dibuat ulang urutannya sama
        position: v.number(),
    }).index('by_history', ['history_id', 'position']),

    login_history: defineTable({
        user_id: v.id('users'),
        device_info: v.string(),
        ip_address: v.string(),
        logged_in_at: v.string(),
        legacy_id: v.optional(v.string()),
    })
        .index('by_logged_in', ['logged_in_at'])
        .index('by_legacy_id', ['legacy_id']),

    appeals: defineTable({
        user_id: v.id('users'),
        appeal_type: v.string(),
        message: v.string(),
        status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected')),
        admin_response: nullable(v.string()),
        responded_by: nullable(v.id('users')),
        responded_at: nullable(v.string()),
        created_at: v.string(),
        legacy_id: v.optional(v.string()),
    })
        .index('by_created', ['created_at'])
        .index('by_legacy_id', ['legacy_id'])
        .index('by_user', ['user_id', 'created_at'])
        .index('by_user_status', ['user_id', 'status']),
})
