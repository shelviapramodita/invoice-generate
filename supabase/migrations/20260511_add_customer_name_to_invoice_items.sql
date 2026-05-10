-- Add customer_name column to invoice_items so each supplier's "Tagihan Kepada"
-- (billing-to) value is preserved per invoice. Previously customer_name was
-- only used at PDF generation time and lost afterwards — making it impossible
-- to edit later from the history view.
--
-- Run this migration once on your Supabase project (Dashboard → SQL Editor),
-- then redeploy the app.

ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Optional: backfill existing rows with a default if you want (safe to skip).
-- UPDATE invoice_items SET customer_name = 'SPPG Tambak' WHERE customer_name IS NULL;
