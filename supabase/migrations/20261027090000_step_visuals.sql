-- Step visuals (P7). A step shows the user's own reference photo, the manual page it cites, and
-- the latest photo taken for it.

-- The user's reference photo for a step: what the result should look like, from their box, kit
-- sheet or an earlier job. Set by the API only (clients read job_steps, never write them).
alter table public.job_steps
  add column reference_evidence_id uuid references public.evidence (id) on delete set null;

-- Manual pages rendered as images, the first time a step needs one, and reused after that.
-- The image sits in the manuals bucket next to its PDF. Server only.
create table public.manual_pages (
  manual_id uuid not null references public.manuals (id) on delete cascade,
  page int not null check (page between 1 and 5000),
  storage_key text not null check (char_length(storage_key) between 1 and 512),
  width int not null check (width > 0),
  height int not null check (height > 0),
  created_at timestamptz not null default now(),
  primary key (manual_id, page)
);
alter table public.manual_pages enable row level security;
grant select, insert, update, delete on public.manual_pages to service_role;
revoke all on public.manual_pages from anon, authenticated;
