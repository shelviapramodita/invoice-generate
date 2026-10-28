// Ekspor data Supabase ke migration-data/*.json untuk diimpor ke Convex.
// Hanya membaca (SELECT). Butuh SUPABASE_DB_URL (connection string Postgres,
// "Session pooler" dari tombol Connect di dashboard Supabase) di .env.local:
//
//   node --env-file=.env.local scripts/export-from-supabase.mjs
//
// Hasilnya berisi hash password user. Folder migration-data/ ada di .gitignore;
// hapus setelah impor selesai.
import { mkdirSync, writeFileSync } from 'node:fs'
import pg from 'pg'

const url = process.env.SUPABASE_DB_URL
if (!url) {
    console.error('SUPABASE_DB_URL belum diisi di .env.local')
    process.exit(1)
}

const queries = {
    users: `
        select u.id, u.email, u.encrypted_password, u.created_at,
               u.raw_user_meta_data ->> 'name' as meta_name,
               to_jsonb(p) as profile
        from auth.users u
        left join public.profiles p on p.id = u.id
        order by u.created_at`,
    subscriptions: 'select to_jsonb(t) as row from public.subscriptions t order by t.created_at',
    subscription_config: 'select to_jsonb(t) as row from public.subscription_config t limit 1',
    appeals: 'select to_jsonb(t) as row from public.appeals t',
    login_history: 'select to_jsonb(t) as row from public.login_history t',
    invoice_history: 'select to_jsonb(t) as row from public.invoice_history t order by t.created_at',
    // Tidak dipakai kode aplikasi; diekspor untuk dicek isinya saja
    revision_log: 'select to_jsonb(t) as row from public.revision_log t',
    // ctid = urutan fisik baris, paling dekat dengan urutan baris Excel saat insert
    invoice_items: `select to_jsonb(t) - 'pdf_file_path' as row from public.invoice_items t order by t.history_id, t.ctid`,
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
mkdirSync('migration-data', { recursive: true })

for (const [name, sql] of Object.entries(queries)) {
    let data
    try {
        const { rows } = await client.query(sql)
        data = name === 'users' ? rows : rows.map((r) => r.row)
    } catch (error) {
        // Tabel opsional (misal appeals) mungkin belum pernah dibuat
        console.warn(`${name}: dilewati (${error.message})`)
        data = []
    }
    writeFileSync(`migration-data/${name}.json`, JSON.stringify(data))
    console.log(`${name}: ${data.length} baris`)
}

await client.end()
console.log('Selesai. File ada di migration-data/')
