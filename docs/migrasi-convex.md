# Migrasi Supabase → Convex

Panduan langkah demi langkah memindahkan Invoice Generator dari Supabase ke Convex. Ditulis Oktober 2026, setelah project Supabase diblokir karena kuota storage penuh.

**Yang dipindah:** akun user (beserta password lamanya), langganan, pengaturan paket, banding, riwayat login, dan riwayat invoice beserta itemnya.

**Yang tidak dipindah:**
- File PDF lama. Tidak dibutuhkan, karena PDF sekarang dibuat ulang dari data invoice.
- File bukti bayar lama (2 file). Storage Supabase terblokir, jadi filenya tidak bisa diunduh. Di admin, langganan lama tampil tanpa bukti.

Perintah di bawah dijalankan di terminal, dari folder project `invoice-generate`.

## Langkah 1 — Sambungkan project Convex (sudah selesai)

1. Daftar Convex lewat link referral.
2. Jalankan `npx convex dev --once`, pilih **Login or create an account**, lalu **create a new project** dengan nama `invoice-generate`.
3. Pasang kunci login untuk deployment dev:

   ```bash
   node scripts/set-convex-auth-keys.mjs --site-url=http://localhost:3000
   ```

Selama mengembangkan aplikasi, jalankan `npx convex dev` di satu terminal (perubahan di `convex/` langsung terkirim) dan `npm run dev` di terminal lain.

## Langkah 2 — Ekspor data dari Supabase

Database Supabase masih bisa dibaca walau Storage dan API-nya diblokir.

1. Di dashboard Supabase, buka project `invoice-generate`, lalu klik **Connect** di bar atas.
2. Pilih tab **Connection String**, lalu pilih **Session pooler**. Salin URI-nya. Bentuknya kira-kira:
   `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
3. Ganti `[YOUR-PASSWORD]` dengan password database. Kalau lupa, buka **Project Settings → Database → Reset database password**.
4. Buka file `.env.local` dan tambahkan satu baris di paling bawah:

   ```
   SUPABASE_DB_URL=postgresql://postgres.xxxx:PASSWORDMU@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

5. Jalankan:

   ```bash
   node --env-file=.env.local scripts/export-from-supabase.mjs
   ```

   Script ini cuma membaca (SELECT), tidak mengubah apa pun di Supabase. Hasilnya ada di folder `migration-data/`, dengan jumlah baris tiap tabel ditampilkan.

> **Penting:** `migration-data/` berisi hash password semua user. Folder ini sudah masuk `.gitignore`, jadi jangan dibagikan, dan hapus setelah Langkah 5 selesai.

## Langkah 3 — Coba impor ke deployment dev

```bash
node scripts/import-to-convex.mjs
```

Di akhir, script menampilkan jumlah data di Convex. Cocokkan dengan jumlah baris dari Langkah 2. Script ini aman dijalankan ulang, karena data yang sudah ada dilewati.

Lalu coba aplikasinya secara lokal (`npm run dev`, buka http://localhost:3000):
- Login dengan akun lamamu, pakai **password lama**.
- Buka **History**, preview satu invoice lama, lalu cek isi dan urutan itemnya.
- Kalau admin: buka `/admin/users` dan `/admin/subscriptions`.

## Langkah 4 — Siapkan production

1. Buat deployment production dan kirim fungsi Convex ke sana:

   ```bash
   npx convex deploy
   ```

   Ketik `y` kalau diminta konfirmasi.

2. Pasang kunci login untuk production:

   ```bash
   node scripts/set-convex-auth-keys.mjs --prod --site-url=https://invoice-generate-v1.vercel.app
   ```

3. Impor data ke production:

   ```bash
   node scripts/import-to-convex.mjs --prod
   ```

4. Buat **deploy key**. Di dashboard Convex, buka project `invoice-generate`, pilih deployment **Production**, lalu **Settings → General → Generate Production Deploy Key**, lalu salin key-nya.

## Langkah 5 — Atur Vercel

Di dashboard Vercel, buka project `invoice-generate-v1`:

1. **Settings → Environment Variables**:
   - Tambah `CONVEX_DEPLOY_KEY` = deploy key dari Langkah 4, khusus environment **Production**.
   - Tambah `NEXT_PUBLIC_CONVEX_URL` = URL deployment dev (lihat `.env.local`, contoh `https://xxx.convex.cloud`), khusus environment **Preview**. Ini supaya build preview untuk PR tetap jalan.
   - Hapus `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`.
2. **Settings → Build and Deployment → Build Command**, nyalakan **Override**, lalu isi:

   ```
   if [ "$VERCEL_ENV" = "production" ]; then npx convex deploy --cmd 'npm run build'; else npm run build; fi
   ```

   Di production, `npx convex deploy` mengirim fungsi Convex terbaru, lalu menjalankan build dengan `NEXT_PUBLIC_CONVEX_URL` production yang diisi otomatis.
3. Merge branch `feat/migrasi-convex` ke `main`. Vercel akan deploy otomatis.
4. Buka https://invoice-generate-v1.vercel.app, login, lalu cek History dan halaman admin.

## Langkah 6 — Bersih-bersih

Setelah production berjalan normal beberapa hari:
- Hapus folder `migration-data/` dan baris `SUPABASE_DB_URL` di `.env.local`.
- Kalau sudah yakin tidak butuh data lama lagi, project Supabase boleh dihapus (**Project Settings → General → Delete project**).

## Kalau ada masalah

| Gejala | Penyebab & solusi |
| --- | --- |
| `SUPABASE_DB_URL belum diisi` | Baris di `.env.local` belum ada, atau perintahnya dijalankan tanpa `--env-file=.env.local`. |
| `password authentication failed` | Password database salah. Reset di **Project Settings → Database**. |
| `ENOTFOUND` / timeout saat ekspor | Pakai URI **Session pooler**, bukan **Direct connection** (yang butuh IPv6). |
| Impor: `X tanpa user` | Baris itu milik user yang tidak ada di `auth.users`, jadi dilewati. |
| Login gagal untuk akun lama | User itu mungkin dulu daftar tanpa password. Admin bisa set password baru lewat **Admin → Users → Recover**. |
| Build Vercel gagal `CONVEX_DEPLOY_KEY` | Env belum diisi untuk Production, atau key-nya untuk deployment dev, bukan production. |
