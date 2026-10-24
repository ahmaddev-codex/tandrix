-- Manuals (T10). Found by web search: shared reference material (owner_id null), cached per
-- make and model. Uploaded or photographed by a user: private to that user, since a customer's
-- manual can be proprietary. Files live in the private "manuals" bucket; the API serves them
-- through signed URLs.

alter table public.manuals
  add column title text not null default 'Manual' check (char_length(title) between 1 and 200),
  add column owner_id uuid references auth.users (id) on delete cascade;
alter table public.manuals alter column title drop default;

drop policy "Signed-in users read manuals" on public.manuals;
create policy "Read shared manuals and your own" on public.manuals
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

-- Pending PDF uploads: issued with a signed upload URL, completed once the API has checked the
-- file. Server only.
create table public.manual_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_key text not null check (char_length(storage_key) between 1 and 512),
  title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.manual_uploads enable row level security;
grant select, insert, update, delete on public.manual_uploads to service_role;
revoke all on public.manual_uploads from anon, authenticated;

create index manuals_owner_idx on public.manuals (owner_id);
