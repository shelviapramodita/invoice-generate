-- Lock down Storage access. Before this, the "Allow all operations on ..." and
-- "Public Access ..." policies granted ALL operations on generated-pdfs and
-- excel-files to every role, including anon. Anyone holding the public anon key
-- could list, download, overwrite, or delete invoice PDFs. The w1pnpy_* policies
-- had no bucket filter, so any logged-in user could read every payment proof.
--
-- The app only touches Storage through a logged-in user's session (server
-- createClient() or the browser client), so authenticated-only policies are
-- enough. Maintenance scripts use the service role key, which bypasses RLS.
--
-- Applied on 2026-10-23 through Dashboard → SQL Editor. In the same change,
-- generated-pdfs was switched to private (Storage → generated-pdfs → Edit bucket
-- → "Public bucket" off). The app never uses public URLs.

begin;

-- generated-pdfs: logged-in users only (no UPDATE; regenerate uploads a new file and removes the old one)
drop policy if exists "Allow all operations on generated-pdfs" on storage.objects;
drop policy if exists "Public Access Generated PDFs" on storage.objects;
create policy "generated-pdfs: baca (login)" on storage.objects
  for select to authenticated using (bucket_id = 'generated-pdfs');
create policy "generated-pdfs: upload (login)" on storage.objects
  for insert to authenticated with check (bucket_id = 'generated-pdfs');
create policy "generated-pdfs: hapus (login)" on storage.objects
  for delete to authenticated using (bucket_id = 'generated-pdfs');

-- excel-files: only the legacy /api/invoices/generate route used this bucket, and nothing calls that route
drop policy if exists "Allow all operations on excel-files" on storage.objects;
drop policy if exists "Public Access Excel Files" on storage.objects;

-- payment-proofs: uploads go to `${user.id}/...` (app/api/subscription/route.ts);
-- admins read them through createSignedUrl (app/api/admin/payment-proof/route.ts)
drop policy if exists "Allow authenticated download w1pnpy_1" on storage.objects;
drop policy if exists "Allow authenticated upload w1pnpy_0" on storage.objects;
create policy "payment-proofs: upload ke folder sendiri" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "payment-proofs: baca punya sendiri atau admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ));

commit;
