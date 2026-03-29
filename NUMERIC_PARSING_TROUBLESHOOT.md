# Troubleshooting: Numeric Parsing Issue (1280 → 1244)

## Investigation Result

✅ **Parser logic is CORRECT** - Confirmed through comprehensive testing:
- XLSX file parsing: 1280 ✓
- Column mapping: Correct (QTY at index 2)
- Number parsing function: All 14 test cases pass
- Parser output: 1280 ✓

## Root Cause Analysis

The value "1244" appearing in history likely stems from **one of these**:

### 1. **Database has corrupted/old data**
- Old data uploaded before the recent fix
- Solution: **Upload file again** to get fresh parsing

### 2. **Frontend modification before save**
- Check `components/history/invoice-detail-view.tsx` line 278 - edit logic for quantity
- Look for any data transformation in upload page

### 3. **Supabase trigger/policy**
- Database trigger might be modifying quantity value
- Check Supabase SQL policies in SUPABASE_SETUP.md

## How to Verify Fix Works

### Step 1: Delete Old Data (Optional)
If you want to clear old problematic records:
```sql
-- In Supabase SQL Editor
DELETE FROM invoice_items WHERE quantity = 1244;
DELETE FROM invoice_history WHERE id NOT IN (SELECT DISTINCT history_id FROM invoice_items);
```

### Step 2: Upload File Fresh
1. Go to http://localhost:3000/upload
2. Select `test-invoice.xlsx`
3. Select any date
4. Click "Generate Invoice"

### Step 3: Check Developer Console
1. Open DevTools (F12)
2. Go to **Console** tab
3. Look for logs like:
   ```
   [Excel] Header found at row 1, column mapping: { URAIAN: 1, QTY: 2, ... }
   [Transform] Row detail for "Susu Diamond Fullcream":
     QTY raw value: 1280 (type: number)
     QTY parsed: 1280
   ```

### Step 4: Verify in History
1. Go to http://localhost:3000/history
2. Click on the invoice you just created
3. Check if QTY shows **1280** (not 1244)

## If Still Shows Wrong Value

If QTY still shows 1244 after fresh upload:

1. **Check database directly**:
   ```sql
   SELECT item_name, quantity FROM invoice_items 
   WHERE item_name LIKE '%Diamond%'
   ORDER BY created_at DESC LIMIT 1;
   ```

2. **Enable more detailed logging**:
   Add this to `/app/api/invoices/generate/route.ts` line 50 (before PDF generation):
   ```typescript
   console.log('[API] Detailed parsed data:', JSON.stringify(parsedData, null, 2));
   ```

3. **Check network tab** in DevTools to see what value is sent to `/api/invoices/generate`

## File Changes Made

| File | Change |
|------|--------|
| `lib/excel-parser.ts` | ✓ Changed `raw: false` → `raw: true` |
| `lib/validators.ts` | ✓ Improved number parsing heuristic |
| Both | ✓ Added debug logging |

## Next Steps

1. **Test with fresh upload** and report if 1280 shows correctly
2. If still wrong → Enable detailed logging (see above)
3. If wrong → Check database directly with SQL query
4. If wrong → Might be frontend edit logic bug (investigate invoice-detail-view.tsx)

---

**Status**: Parser fix is complete and verified. Issue now is either:
- Old data needs to be cleared and re-uploaded
- OR there's a bug elsewhere in the stack (frontend/database)
