# Setup Supabase untuk Invoice Generator

Panduan lengkap untuk setup Supabase database dan storage untuk project Invoice Generator.

## 📋 Prerequisites

- Akun Supabase (gratis): https://supabase.com

---

## 🚀 Langkah Setup

### 1. Buat Project Baru di Supabase

1. Login ke https://supabase.com/dashboard
2. Klik **"New Project"**
3. Isi informasi project:
   - **Name**: `invoice-generator` (atau nama lain)
   - **Database Password**: Simpan password ini dengan aman!
   - **Region**: Pilih yang terdekat (contoh: Southeast Asia - Singapore)
4. Klik **"Create new project"**
5. Tunggu ~2 menit hingga project selesai dibuat

---

### 2. Setup Database Tables

1. Di Supabase Dashboard, klik menu **"SQL Editor"** (ikon </> di sidebar)
2. Klik **"+ New Query"**
3. Copy seluruh isi file `supabase-setup.sql` dari project ini
4. Paste ke SQL Editor
5. Klik **"Run"** atau tekan `Ctrl+Enter`
6. Pastikan muncul pesan sukses ✅

**Tables yang dibuat:**
- `invoice_history` - Menyimpan data batch invoice
- `invoice_items` - Menyimpan detail item per invoice

---

### 3. Setup Storage Bucket

1. Di Supabase Dashboard, klik menu **"Storage"** di sidebar
2. Klik **"Create a new bucket"**
3. Isi form:
   - **Name**: `generated-pdfs`
   - **Public bucket**: ✅ **CENTANG INI** (agar PDF bisa diakses)
4. Klik **"Create bucket"**

#### Setup Storage Policies:

1. Klik bucket `generated-pdfs` yang baru dibuat
2. Klik tab **"Policies"**
3. Klik **"New Policy"**

**Policy 1 - Allow Upload:**
- Template: "Custom policy"
- Policy name: `Allow uploads`
- Allowed operations: ✅ INSERT
- Policy definition: `true`
- Klik **"Review"** → **"Save policy"**

**Policy 2 - Allow Download:**
- Klik **"New Policy"** lagi
- Policy name: `Allow downloads`
- Allowed operations: ✅ SELECT
- Policy definition: `true`
- Klik **"Review"** → **"Save policy"**

**Policy 3 - Allow Delete (Optional):**
- Policy name: `Allow deletes`
- Allowed operations: ✅ DELETE
- Policy definition: `true`
- Klik **"Review"** → **"Save policy"**

---

### 4. Dapatkan API Credentials

1. Di Supabase Dashboard, klik menu **"Settings"** (ikon gear) di sidebar
2. Klik **"API"** di sub-menu
3. Copy 2 values ini:

**a) Project URL:**
```
https://xxxxxxxxxxxxx.supabase.co
```

**b) anon public key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
```
(Key yang panjang, bukan service_role key!)

---

### 5. Update File `.env.local`

1. Buka file `.env.local` di root project
2. Ganti placeholder dengan credentials dari langkah 4:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
```

3. **Save** file

---

### 6. Restart Development Server

```bash
# Stop server (Ctrl+C jika sedang running)
npm run dev
```

---

## ✅ Test Connection

1. Buka browser ke http://localhost:3000
2. Upload Excel file
3. Generate PDF
4. Jika tidak ada error "Supabase URL and Key are required" → **Berhasil!** 🎉

---

## 📊 Verifikasi Data

### Cek Tables:
1. Klik **"Table Editor"** di Supabase Dashboard
2. Pilih table `invoice_history` atau `invoice_items`
3. Lihat data yang baru di-generate

### Cek Storage:
1. Klik **"Storage"** → `generated-pdfs`
2. Lihat PDF files yang ter-upload

---

## 🔒 Security Notes

- ⚠️ **JANGAN commit** file `.env.local` ke Git (sudah ada di `.gitignore`)
- ⚠️ **JANGAN share** `service_role` key (hanya pakai `anon` key)
- ✅ File `.env.local` hanya untuk development
- ✅ Untuk production, set environment variables di hosting platform (Vercel, Netlify, dll)

---

## 🆘 Troubleshooting

### Error: "Supabase URL and Key are required"
- Pastikan file `.env.local` ada di root project
- Pastikan tidak ada typo di nama variable
- Restart dev server setelah edit `.env.local`

### Error: "Failed to create invoice history"
- Pastikan SQL schema sudah dijalankan
- Cek di Table Editor apakah tables `invoice_history` dan `invoice_items` ada
- Cek RLS policies sudah enable

### Error: "Failed to upload PDF"
- Pastikan bucket `generated-pdfs` sudah dibuat
- Pastikan bucket di-set **public**
- Cek storage policies sudah dibuat (INSERT, SELECT)

---

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
