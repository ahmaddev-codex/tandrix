-- Desktop pairing (T21): the Mac shows a short code as a QR; a signed-in phone approves it; the
-- Mac, holding a separate poll token, collects a one-time sign-in for that user. Codes and poll
-- tokens are stored only as SHA-256 hashes. Server only.
create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (char_length(code_hash) = 64),
  poll_hash text not null check (char_length(poll_hash) = 64),
  device_name text not null check (char_length(device_name) between 1 and 80),
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  consumed_at timestamptz,
  -- Approved means approved by someone; only an approved pairing can be used.
  constraint pairings_approved_by_user check ((approved_at is null) = (user_id is null)),
  constraint pairings_consumed_after_approval check (consumed_at is null or approved_at is not null)
);
create index pairings_expires_at on public.pairings (expires_at);

alter table public.pairings enable row level security;
grant select, insert, update, delete on public.pairings to service_role;
revoke all on public.pairings from anon, authenticated;
