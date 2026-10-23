# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # production build
npm run lint         # eslint (flat config: next core-web-vitals + typescript)
npx tsc --noEmit     # typecheck
npx eslint <file>    # lint a single file
npm run typecheck    # tsc --noEmit
scripts/test-check-no-ai.sh   # test the AI-attribution patterns
```

There is no test suite. Verify changes with `tsc`, `eslint`, `npm run build`, and by running the app. `npm run lint` still reports older `no-explicit-any` errors, so make sure you do not add new ones.

Env vars (in `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (only used for admin password reset in `app/api/admin/users/actions/route.ts`).

## What the app does

Internal Next.js 16 (App Router) + Supabase app for an SPPG (school-meal kitchen) operator. The user uploads an Excel "RAB" workbook (one sheet per day), items are grouped by supplier, and one PDF invoice per supplier is rendered and saved to history. Users need an admin-approved paid subscription; admins manage subscriptions, users, appeals, and plan settings under `/admin`.

UI copy, toasts, and most code comments are in Bahasa Indonesia — keep new strings in Indonesian.

## Architecture

### Auth gating
`middleware.ts` → `lib/supabase/middleware.ts:updateSession` is the single source of truth for page access: unauthenticated → `/login`, suspended/banned (non-admin) → `/blocked`, no active subscription (non-admin) → `/subscribe`, `/admin/*` requires `profiles.role === 'admin'`. Role is read from the `profiles` table, never from user metadata.

Middleware skips `/api/*`, so **every API route authenticates itself** (`createClient()` from `lib/supabase/server.ts` → `supabase.auth.getUser()`, plus a role check for admin routes). Three Supabase clients exist: `lib/supabase/client.ts` (browser), `server.ts` (route handlers/server components), `middleware.ts`.

`components/auth/session-guard.tsx` enforces single-active-session (localStorage `invoice_session_id` vs `profiles.active_session_id`, polled via `/api/session`) and idle logout.

### Excel → items (`lib/excel/parser.ts`, `lib/excel/normalizer.ts`)
- Parsing runs **in the browser** (`components/excel/excel-uploader.tsx` → `parseExcelWorkbook`). The server only receives the already-parsed items.
- `parseExcelWorkbook` parses every sheet; `parseSheetName` derives date / date range / category (`OPS`, `OPS GALON`) / tahap from Indonesian sheet names like `"21 JAN 2026 DONE"`.
- Header row is detected by column aliases (URAIAN, QTY, HARGA, SATUAN, TOTAL, SUPPLIER). Numbers use Indonesian separators (`parseIndonesianNumber`).
- Rows with an empty SUPPLIER cell are attributed by looking ahead to the next `NO REK. <account> <bank>` line.
- `normalizeItemName` rewrites item names (title case, units, `isi N` parentheses, stripping quality/packaging notes). Changes here affect preview, PDF, and DB.

### Suppliers — keep these in sync
Suppliers are a hardcoded, authorized list. An unknown supplier must **not** fall back to a default template; it raises `UnrecognizedSupplierError` and is reported back to the user. Adding or renaming a supplier touches:
- `data/cv-reference.ts` — `supplierMapping` (bank account, `legacyBankAccounts`, address, theme color) and `getSupplierConfig` (legacy name aliases, account-number matching)
- `lib/pdf/utils.ts` — `SupplierTemplateKey` + `getSupplierTemplateKey` (keyword matching; order matters, e.g. SUSILO is checked before YUWONO)
- `lib/validators.ts` — `normalizeSupplierName`
- `lib/pdf/templates/index.ts:renderSupplierTemplate` — the only supplier → template map, used both for the first generation (`pdf-generator.ts`) and for the `/history` PATCH regenerate
- `lib/pdf/templates/*-template.tsx` and `public/assets/<supplier>/`

Some suppliers share a template (Nusantara Food and Susilo Widyono both use `sekar-wijayakusuma-template.tsx`, differing by `signatureName`).

### PDF generation
- PDFs are rendered **server-side only** with `@react-pdf/renderer` (listed in `serverExternalPackages` in `next.config.ts`). Assets are loaded from disk via `getAssetPath`.
- Every PDF embeds the logo/signature/stamp PNGs in full, and every generated PDF is kept in the `generated-pdfs` bucket (Supabase free tier: 1 GB storage). Keep those PNGs at ~300 dpi of their display size: logo box 55pt → ~230 px, signature box 90pt → ~375 px, stamp 50pt → ~210 px. A 1000 px logo once made every PDF ~800 KB and pushed storage over quota.
- Main path: client → `POST /api/generate-pdf` → `generateInvoicePDFsWithNumbers` → PDFs returned as base64 in JSON, uploaded to the `generated-pdfs` bucket, and written to `invoice_history` + `invoice_items`. The client decodes them for preview and download through `lib/pdf/download.ts` (single file, ZIP via `jszip`, or merged via `pdf-lib`). Keep that module free of `@react-pdf/renderer` imports so the browser never loads the renderer.
- Document variants: `'tagihan'` (title TAGIHAN, signature, no LUNAS stamp) and `'kwitansi'` (title KWITANSI, no signature, customer label "Pembayaran"). Rules live in `lib/pdf/doc-variant.ts` (client-safe, imported by both templates and `app/upload/page.tsx`): Tambak/Sumpiuh/Buayan always use these variants; other customers only for invoices dated from 2026-10-12 (`ALL_CUSTOMER_VARIANTS_FROM`). Before that they get the legacy `'faktur'` (title FAKTUR, signature + LUNAS stamp, no toggle, batch prefix "Kwitansi"). Each template calls `resolveDocType(customerName, invoiceDate, documentType)` itself, so the generator and the `/history` PATCH regenerate both follow the cutoff. `documentType` undefined means TAGIHAN. The variant is toggled in `components/invoice/fullscreen-pdf-preview.tsx` (hidden when every selected sheet is legacy); the first generation is TAGIHAN and saves history, and switching re-calls `/api/generate-pdf` with `saveHistory: false`. Batch/file names are prefixed "Tagihan"/"Kwitansi" to match. Helpers: `getInvoiceTitle`, `getInvoiceNumberLabel`, `shouldHideSignature`, `shouldShowStamp`, `getCustomerLabelPrefix` in `lib/pdf/utils.ts`.
- The number/date header box (No. Tagihan/Kwitansi + Tanggal) is the shared `lib/pdf/templates/invoice-meta.tsx` (`InvoiceMeta`), used by all five templates and colored with each supplier's theme. Change header layout there, not in each template.
- Invoice numbers are `#0001`-style (`generateInvoiceNumber`), with no prefix. The user enters the starting number in `app/upload/page.tsx`, numbering continues sequentially across the selected sheets, and the starting number is kept in localStorage. Upload-flow state, including the per-variant PDF cache, lives in `useState` in that page.
- Customer ("Tagihan Kepada"): the SPPG name defaults from the workbook filename (`extractSppgNameFromFilename` in `lib/excel/normalizer.ts`, e.g. `"RAB SPPG Tambak (3).xlsx"` → `"Tambak"`) and can be overridden per supplier (`customerNames` record in `pdf-generator.ts`, falling back to `customerName`). Templates default to `'SPPG Pandansari'`. It is persisted in `invoice_items.customer_name` (migration `20260511_...`). `createInvoiceItems` in `lib/db/queries.ts` retries the insert without that column if it is missing, so keep that fallback when touching the insert.
- Editing in `/history` → `PATCH /api/invoices/[id]` applies item edits/inserts/deletes, recomputes totals, then re-renders PDFs for **every** supplier in that history row and replaces the stored files.
- `invoice_items.pdf_file_path` sentinels: `'client-side-download'` (storage upload failed) and `'pending-regeneration'` (new item before regen). Skip storage deletes for these.

### Data
Supabase tables: `profiles`, `subscriptions`, `subscription_config` (singleton row), `invoice_history`, `invoice_items`, `login_history`, `appeals`. Storage buckets: `excel-files` (unused), `generated-pdfs`, `payment-proofs`. All three are private, and storage RLS allows authenticated users only (see `supabase/migrations/20261023_lock_down_storage_policies.sql`). Never re-add anon or public policies, because the anon key ships to every browser. Most of the schema lives in Supabase, not in the repo; `supabase/migrations/` only holds incremental changes. Shared types are in `types/index.ts`, and DB helpers in `lib/db/queries.ts`.

## Conventions
- 4-space indent, single quotes; semicolon usage varies, so match the file you're editing.
- API responses: `{ success: true, data }` on success, `{ error, message? }` on failure. API routes that read auth use `export const dynamic = 'force-dynamic'`.
- UI: shadcn/ui (`components/ui/*`), `lucide-react` icons, `sonner` toasts (`toast.success/error/warning`). Currency/date formatting goes through `lib/pdf/utils.ts` (`formatCurrency`, `formatNumber`, `formatDate`).

## Git workflow

- Branch from `main` (`feat/…`, `fix/…`, `chore/…`, `docs/…`), one topic per PR. Commit messages use Conventional Commits in Bahasa Indonesia.
- CI (`.github/workflows/ci.yml`) runs typecheck and a production build on every PR and push to `main`. Vercel deploys `main` to production.

### No AI attribution

Commits, PRs, and comments are recorded under the human who made them. No AI account may appear as an author, a committer, or in the repo's Contributors list. Never write:
- trailers such as `Co-Authored-By: Claude <noreply@anthropic.com>`, `Claude-Session: …`, `Assisted-by: …`, or the equivalent from other agents (Codex, Copilot, Cursor, Gemini, Aider, Devin, Jules, Amp, Warp, and so on);
- footers such as `🤖 Generated with Claude Code` or `Generated by Copilot`, or agent session links;
- an AI agent or bot as the commit author or committer.

Claude Code attribution is turned off in `.claude/settings.json`. The rule is enforced in layers:

| Layer | Checks | When |
| --- | --- | --- |
| `.githooks/commit-msg` | Commit message | Every `git commit` |
| `.githooks/pre-push` | Author, committer, and message of every pushed commit | Every `git push` |
| `.github/workflows/no-ai-attribution.yml` | Same as pre-push, plus PR title and body | Every PR and push to `main` |

`npm install` turns the hooks on through the `prepare` script. Without that, run `git config core.hooksPath .githooks` once per clone. If a check fails, fix the commit (`git commit --amend`, or `git rebase -i origin/main` for older commits) instead of skipping it with `--no-verify`. CI rejects it anyway. Patterns live in `scripts/check-no-ai.sh`, and examples live in `scripts/test-check-no-ai.sh`.

Commits on `main` from before 2026-10-23 still carry `Co-authored-by: Claude` trailers. GitHub does not count trailers toward Contributors, and the workflow only checks new commits.
