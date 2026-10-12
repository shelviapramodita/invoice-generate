# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # production build
npm run lint         # eslint (flat config: next core-web-vitals + typescript)
npx tsc --noEmit     # typecheck (no script for it)
npx eslint <file>    # lint a single file
```

There is no test suite. Verify changes with `tsc`, `eslint`, and by running the app. Loose `*.js` scripts in the repo root (`generate-sample.js`, `create-test-file.js`, `tmp_read_exact.js`) are ad-hoc Node scripts for inspecting/creating Excel files with `xlsx`, not part of the app.

Env vars (in `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (only used for admin password reset in `app/api/admin/users/actions/route.ts`).

## What the app does

Internal Next.js 16 (App Router) + Supabase app for an SPPG (school-meal kitchen) operator. The user uploads an Excel "RAB" workbook (one sheet per day), items are grouped by supplier, and one PDF invoice per supplier is rendered and saved to history. Users need an admin-approved paid subscription; admins manage subscriptions, users, appeals, and plan settings under `/admin`.

UI copy, toasts, and most code comments are in Bahasa Indonesia — keep new strings in Indonesian.

## Architecture

### Auth gating
`middleware.ts` → `lib/supabase/middleware.ts:updateSession` is the single source of truth for page access: unauthenticated → `/login`, suspended/banned (non-admin) → `/blocked`, no active subscription (non-admin) → `/subscribe`, `/admin/*` requires `profiles.role === 'admin'`. Role is read from the `profiles` table, never from user metadata.

Middleware skips `/api/*`, so **every API route authenticates itself** (`createClient()` from `lib/supabase/server.ts` → `supabase.auth.getUser()`, plus a role check for admin routes). Three Supabase clients exist: `lib/supabase/client.ts` (browser), `server.ts` (route handlers/server components), `middleware.ts`.

`components/auth/session-guard.tsx` enforces single-active-session (localStorage `invoice_session_id` vs `profiles.active_session_id`, polled via `/api/session`) and idle logout.

### Excel → items (`lib/excel-parser.ts`, `lib/text-normalizer.ts`)
- Parsing runs **in the browser** (`components/excel/excel-uploader.tsx` → `parseExcelWorkbook`). The server only receives the already-parsed items. `app/api/invoices/generate` (server-side `parseExcelFile`) is a legacy route with no callers.
- `parseExcelWorkbook` parses every sheet; `parseSheetName` derives date / date range / category (`OPS`, `OPS GALON`) / tahap from Indonesian sheet names like `"21 JAN 2026 DONE"`.
- Header row is detected by column aliases (URAIAN, QTY, HARGA, SATUAN, TOTAL, SUPPLIER). Numbers use Indonesian separators (`parseIndonesianNumber`).
- Rows with an empty SUPPLIER cell are attributed by looking ahead to the next `NO REK. <account> <bank>` line.
- `normalizeItemName` rewrites item names (title case, units, `isi N` parentheses, stripping quality/packaging notes). Changes here affect preview, PDF, and DB.

### Suppliers — keep these in sync
Suppliers are a hardcoded, authorized list. An unknown supplier must **not** fall back to a default template; it raises `UnrecognizedSupplierError` and is reported back to the user. Adding or renaming a supplier touches:
- `data/cv-reference.ts` — `supplierMapping` (bank account, `legacyBankAccounts`, address, theme color) and `getSupplierConfig` (legacy name aliases, account-number matching)
- `lib/pdf/utils.ts` — `SupplierTemplateKey` + `getSupplierTemplateKey` (keyword matching; order matters, e.g. SUSILO is checked before YUWONO)
- `lib/validators.ts` — `isValidSupplier`, `normalizeSupplierName`
- `lib/pdf/pdf-generator.ts:generatePDFForSupplier` **and** the duplicated switch in `app/api/invoices/[id]/route.ts` (PATCH regenerate)
- `lib/pdf/templates/*-template.tsx` and `public/assets/<supplier>/`

Some suppliers share a template (Nusantara Food and Susilo Widyono both use `sekar-wijayakusuma-template.tsx`, differing by `signatureName`).

### PDF generation
- PDFs are rendered **server-side only** with `@react-pdf/renderer` (listed in `serverExternalPackages` in `next.config.ts`). Assets are loaded from disk via `getAssetPath`.
- Main path: client → `POST /api/generate-pdf` → `generateInvoicePDFsWithNumbers` → PDFs returned as base64 in JSON, uploaded to the `generated-pdfs` bucket, and written to `invoice_history` + `invoice_items`. The client decodes them for preview and download (single file, ZIP via `jszip`, or merged via `pdf-lib`).
- Document variants (all customers): `'tagihan'` (title TAGIHAN, signature, no LUNAS stamp) and `'kwitansi'` (title KWITANSI, no signature, customer label "Pembayaran"). No template renders the LUNAS stamp any more. `documentType` undefined means TAGIHAN (e.g. regenerate from `/history`). The variant is toggled in `components/invoice/fullscreen-pdf-preview.tsx`; the first generation is TAGIHAN and saves history, and switching re-calls `/api/generate-pdf` with `saveHistory: false`. Batch/file names are prefixed "Tagihan"/"Kwitansi" to match. Helpers: `getInvoiceTitle`, `getInvoiceNumberLabel`, `shouldHideSignature`, `getCustomerLabelPrefix` in `lib/pdf/utils.ts`.
- The number/date header box (No. Tagihan/Kwitansi + Tanggal) is the shared `lib/pdf/templates/invoice-meta.tsx` (`InvoiceMeta`), used by all five templates and colored with each supplier's theme. Change header layout there, not in each template.
- Invoice numbers are `#0001`-style (`generateInvoiceNumber`), with no prefix. The user enters the starting number in `app/upload/page.tsx`, numbering continues sequentially across the selected sheets, and the starting number is kept in localStorage. Upload-flow state, including the per-variant PDF cache, lives in `useState` in that page. `zustand` is a dependency but is not used.
- Editing in `/history` → `PATCH /api/invoices/[id]` applies item edits/inserts/deletes, recomputes totals, then re-renders PDFs for **every** supplier in that history row and replaces the stored files.
- `invoice_items.pdf_file_path` sentinels: `'client-side-download'` (storage upload failed) and `'pending-regeneration'` (new item before regen). Skip storage deletes for these.

### Data
Supabase tables: `profiles`, `subscriptions`, `subscription_config` (singleton row), `invoice_history`, `invoice_items`, `login_history`, `appeals`. Storage buckets: `excel-files`, `generated-pdfs`, `payment-proofs`. Most of the schema lives in Supabase, not in the repo; `supabase/migrations/` only holds incremental changes. Shared types are in `types/index.ts`, and DB helpers in `lib/db/queries.ts`.

## Conventions
- 4-space indent, single quotes; semicolon usage varies, so match the file you're editing.
- API responses: `{ success: true, data }` on success, `{ error, message? }` on failure. API routes that read auth use `export const dynamic = 'force-dynamic'`.
- UI: shadcn/ui (`components/ui/*`), `lucide-react` icons, `sonner` toasts (`toast.success/error/warning`). Currency/date formatting goes through `lib/pdf/utils.ts` (`formatCurrency`, `formatNumber`, `formatDate`, `formatDateLong`).
- `*.bak*` / `*.backup` files under `components/` are stale copies; ignore them.
