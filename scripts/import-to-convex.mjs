// Impor migration-data/*.json (hasil scripts/export-from-supabase.mjs) ke
// Convex lewat mutation internal di convex/migrate.ts. Aman diulang: data
// yang sudah ada dilewati.
//
//   node scripts/import-to-convex.mjs          # deployment dev (.env.local)
//   node scripts/import-to-convex.mjs --prod   # deployment production
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const prod = process.argv.includes('--prod')
// Batas panjang argumen command line macOS ~1 MB; sisakan ruang
const MAX_BATCH_BYTES = 300_000

const read = (name) => JSON.parse(readFileSync(`migration-data/${name}.json`, 'utf8'))
const iso = (value) => (value ? new Date(value).toISOString() : null)
const text = (value) => (value === undefined || value === null ? null : String(value))
const num = (value) => Number(value ?? 0)

function run(fn, args) {
    const out = execFileSync('npx', ['convex', 'run', ...(prod ? ['--prod'] : []), `migrate:${fn}`, JSON.stringify(args)], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'inherit'],
    })
    return JSON.parse(out.slice(out.indexOf('{')))
}

// Kirim per batch (berdasarkan ukuran JSON), jumlahkan hasilnya
function importRows(fn, rows) {
    const total = { inserted: 0, skipped: 0, missing_user: 0 }
    let batch = []
    let size = 0
    const flush = () => {
        if (batch.length === 0) return
        const result = run(fn, { rows: batch })
        for (const key of Object.keys(total)) total[key] += result[key]
        process.stdout.write(`\r${fn}: ${total.inserted + total.skipped + total.missing_user}/${rows.length}`)
        batch = []
        size = 0
    }
    for (const row of rows) {
        const rowSize = JSON.stringify(row).length
        if (size + rowSize > MAX_BATCH_BYTES) flush()
        batch.push(row)
        size += rowSize
    }
    flush()
    console.log(`\r${fn}: ${total.inserted} baru, ${total.skipped} sudah ada, ${total.missing_user} tanpa user`)
}

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)

// 1. Users (+ hash password bcrypt)
importRows('importUsers', read('users').filter((u) => u.email).map((u) => {
    const p = u.profile ?? {}
    return {
        legacy_id: u.id,
        email: u.email.trim().toLowerCase(),
        name: text(p.name ?? u.meta_name),
        password_hash: text(u.encrypted_password) || null,
        role: oneOf(p.role, ['admin', 'user'], 'user'),
        account_status: oneOf(p.account_status, ['active', 'suspended', 'banned'], 'active'),
        suspend_reason: text(p.suspend_reason),
        suspended_until: iso(p.suspended_until),
        suspended_at: iso(p.suspended_at),
        ban_reason: text(p.ban_reason),
        banned_at: iso(p.banned_at),
        last_login_at: iso(p.last_login_at),
        last_login_device: text(p.last_login_device),
        created_at: iso(p.created_at ?? u.created_at),
    }
}))

// 2. Langganan (file bukti bayar lama tidak ikut pindah)
importRows('importSubscriptions', read('subscriptions').map((s) => ({
    legacy_id: s.id,
    user_legacy_id: s.user_id,
    status: oneOf(s.status, ['pending', 'active', 'rejected', 'expired'], 'expired'),
    legacy_payment_proof_path: text(s.payment_proof_url),
    submitted_at: iso(s.submitted_at),
    approved_at: iso(s.approved_at),
    approved_by_legacy_id: text(s.approved_by),
    expires_at: iso(s.expires_at),
    reject_reason: text(s.reject_reason),
    created_at: iso(s.created_at ?? s.submitted_at) ?? new Date().toISOString(),
})))

// 3. Pengaturan paket
const [config] = read('subscription_config')
if (config) {
    run('importConfig', {
        row: {
            plan_name: String(config.plan_name ?? 'Paket'),
            price: num(config.price),
            duration_days: num(config.duration_days || 30),
            description: text(config.description),
            bank_name: String(config.bank_name ?? 'BCA'),
            bank_account_number: String(config.bank_account_number ?? ''),
            bank_account_holder: String(config.bank_account_holder ?? ''),
            features: Array.isArray(config.features) ? config.features.map(String) : [],
            updated_at: iso(config.updated_at),
        },
    })
    console.log('importConfig: selesai')
}

// 4. Banding & riwayat login
importRows('importAppeals', read('appeals').map((a) => ({
    legacy_id: a.id,
    user_legacy_id: a.user_id,
    appeal_type: String(a.appeal_type ?? ''),
    message: String(a.message ?? ''),
    status: oneOf(a.status, ['pending', 'approved', 'rejected'], 'pending'),
    admin_response: text(a.admin_response),
    responded_by_legacy_id: text(a.responded_by),
    responded_at: iso(a.responded_at),
    created_at: iso(a.created_at) ?? new Date().toISOString(),
})))

importRows('importLoginHistory', read('login_history').map((l) => ({
    legacy_id: l.id,
    user_legacy_id: l.user_id,
    device_info: String(l.device_info ?? 'Unknown'),
    ip_address: String(l.ip_address ?? 'Unknown'),
    logged_in_at: iso(l.logged_in_at ?? l.created_at) ?? new Date().toISOString(),
})))

// 5. Riwayat invoice + item (urutan item dari ekspor dipertahankan)
const itemsByHistory = new Map()
for (const item of read('invoice_items')) {
    if (!itemsByHistory.has(item.history_id)) itemsByHistory.set(item.history_id, [])
    itemsByHistory.get(item.history_id).push({
        supplier: String(item.supplier ?? ''),
        invoice_number: String(item.invoice_number || '#0001'),
        item_name: String(item.item_name ?? ''),
        quantity: num(item.quantity),
        unit: String(item.unit ?? ''),
        price: num(item.price),
        total: num(item.total),
        customer_name: text(item.customer_name),
    })
}

// Riwayat lama tanpa pemilik (user_id null, dari versi awal app) diberikan ke
// admin paling lama supaya tidak hilang; admin memang melihat semua invoice
const users = read('users')
const knownUserIds = new Set(users.map((u) => u.id))
const fallbackOwner = users
    .filter((u) => u.profile?.role === 'admin')
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0]?.id ?? ''
const ownerless = read('invoice_history').filter((h) => !knownUserIds.has(h.user_id)).length
if (ownerless > 0) console.log(`${ownerless} riwayat tanpa pemilik diberikan ke admin paling lama`)

importRows('importInvoiceHistory', read('invoice_history').map((h) => ({
    legacy_id: h.id,
    user_legacy_id: knownUserIds.has(h.user_id) ? h.user_id : fallbackOwner,
    batch_name: text(h.batch_name),
    invoice_date: iso(h.invoice_date) ?? iso(h.created_at),
    status: oneOf(h.status, ['generated', 'completed'], 'generated'),
    created_at: iso(h.created_at) ?? new Date().toISOString(),
    items: itemsByHistory.get(h.id) ?? [],
})))

console.log('\nJumlah data di Convex sekarang:')
console.log(run('counts', {}))
