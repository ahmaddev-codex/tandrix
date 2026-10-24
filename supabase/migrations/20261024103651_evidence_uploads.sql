-- Evidence uploads (T8). The API creates the evidence row and a signed upload URL; the client
-- uploads straight to storage; the API then confirms the object exists and sets uploaded_at.
-- Clients only ever see confirmed uploads.

alter table public.evidence add column uploaded_at timestamptz;

drop policy "Owners read their evidence" on public.evidence;
create policy "Owners read their uploaded evidence" on public.evidence
  for select to authenticated
  using (uploaded_at is not null and deleted_at is null and public.owns_job(job_id));

-- Storage objects: no client policies on the evidence or manuals buckets, so signed-in users
-- can't list, read or write them directly. Uploads use signed upload URLs and reads use signed
-- URLs, both issued by the API after an ownership check.
