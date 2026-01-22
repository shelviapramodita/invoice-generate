-- ============================================
-- SUPABASE SETUP SQL
-- Invoice Generator Database Schema
-- ============================================

-- 1. Create invoice_history table
CREATE TABLE IF NOT EXISTS invoice_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name TEXT,
    invoice_date TIMESTAMPTZ NOT NULL,
    total_suppliers INTEGER NOT NULL DEFAULT 0,
    total_items INTEGER NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('generated', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    history_id UUID NOT NULL REFERENCES invoice_history(id) ON DELETE CASCADE,
    supplier TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    total NUMERIC(15, 2) NOT NULL,
    pdf_file_path TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    edit_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoice_items_history_id ON invoice_items(history_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_supplier ON invoice_items(supplier);
CREATE INDEX IF NOT EXISTS idx_invoice_history_created_at ON invoice_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_history_status ON invoice_history(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE invoice_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- 5. Create policies (Public access for now - adjust based on your auth needs)
-- Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users on invoice_history"
    ON invoice_history
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users on invoice_items"
    ON invoice_items
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- If you want public access (no auth required), use these instead:
-- CREATE POLICY "Allow public access on invoice_history"
--     ON invoice_history
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);

-- CREATE POLICY "Allow public access on invoice_items"
--     ON invoice_items
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);

-- ============================================
-- STORAGE BUCKET SETUP
-- Run this in Supabase Dashboard > Storage
-- ============================================

-- Note: Storage buckets are created via the Supabase Dashboard UI
-- After creating the bucket named "generated-pdfs", apply these policies:

-- 1. Go to Storage > generated-pdfs > Policies
-- 2. Create policy for INSERT:
--    Name: "Allow uploads"
--    Operation: INSERT
--    Policy definition: true

-- 3. Create policy for SELECT:
--    Name: "Allow downloads"
--    Operation: SELECT
--    Policy definition: true

-- 4. Create policy for DELETE (optional):
--    Name: "Allow deletes"
--    Operation: DELETE
--    Policy definition: true
