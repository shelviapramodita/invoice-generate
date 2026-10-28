# Migrasi Supabase → Convex

Catatan pemindahan backend Invoice Generator dari Supabase ke Convex. Migrasinya **sudah selesai pada 28 Oktober 2026** (PR #3).

## Kenapa pindah

Project Supabase paket gratis diblokir karena kuota storage 1 GB penuh, terisi 793 MB file PDF di bucket `generated-pdfs`. Akibatnya seluruh project, termasuk login, berhenti melayani request. Sejak `f53c382`, PDF tidak disimpan lagi dan selalu dibuat ulang dari data invoice. Setelah itu backend dipindah ke Convex.

## Yang dipindah

| Data | Jumlah |
| --- | --- |
| User, beserta hash password bcrypt-nya (user login dengan password lama) | 3 |
| Langganan | 2 |
| Pengaturan paket | 1 |
| Banding | 1 |
| Riwayat login | 167 |
| Riwayat invoice | 2.153 |
| Item invoice | 34.460 |

Riwayat invoice lama yang tidak punya pemilik (19 baris, `user_id` kosong) diberikan ke akun admin paling lama. Baris hasil impor menyimpan UUID Supabase-nya di kolom `legacy_id`.

**Tidak dipindah:** file PDF lama (tidak dibutuhkan), bucket `excel-files` yang tidak dipakai, dan 2 file bukti bayar lama karena Storage Supabase terblokir. Di admin, langganan lama tampil tanpa bukti.

Script ekspor/impor dan fungsi `convex/migrate.ts` sudah dihapus setelah impor selesai. Kalau suatu saat dibutuhkan lagi, ambil dari riwayat git (PR #3).

## Deployment

| | Convex | Vercel |
| --- | --- | --- |
| Development | `superb-impala-999` (berisi salinan data asli + data tes `@example.test`) | Preview, lewat `NEXT_PUBLIC_CONVEX_URL` di environment Preview |
| Production | `standing-goshawk-893` | Production, lewat `CONVEX_DEPLOY_KEY` (izin `deployment:deploy` saja) |

Build Command di Vercel:

```
if [ "$VERCEL_ENV" = "production" ]; then npx convex deploy --cmd 'npm run build'; else npm run build; fi
```

## Kunci login (Convex Auth)

Setiap deployment Convex butuh env `JWT_PRIVATE_KEY`, `JWKS`, dan `SITE_URL`. Untuk deployment baru, atau kalau kuncinya perlu diganti (semua user akan ter-logout):

```bash
node scripts/set-convex-auth-keys.mjs --site-url=http://localhost:3000                         # dev
node scripts/set-convex-auth-keys.mjs --prod --site-url=https://invoice-generate-v1.vercel.app  # production
```
