# Clear Problematic Invoice Data

Jika Anda ingin menghapus data invoice lama yang memiliki nilai QTY salah (1244):

## Option 1: Delete Specific Item
```sql
-- Masuk ke Supabase SQL Editor
-- Hapus invoice item dengan QTY 1244
DELETE FROM invoice_items WHERE quantity = 1244;

-- Kemudian hapus invoice history yang tidak memiliki items
DELETE FROM invoice_history WHERE id NOT IN (SELECT DISTINCT history_id FROM invoice_items);
```

## Option 2: Delete All Data (Reset Completely)
```sql
-- Hapus semua data
TRUNCATE TABLE invoice_items CASCADE;
TRUNCATE TABLE invoice_history CASCADE;
```

## Option 3: Via Supabase UI
1. Go to Supabase Dashboard → Your Project → Database
2. Click on `invoice_items` table
3. Filter where `quantity = 1244`
4. Click the rows and delete them
5. Then go to `invoice_history` and delete history records with no items

---

**After clearing**, upload the file fresh through the UI and check if 1280 appears correctly now.
