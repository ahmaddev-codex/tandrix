-- People who asked to hear when Tandrix is ready for their device, from the website. Server only.
create table public.early_access (
  email text primary key check (char_length(email) between 3 and 254),
  platform text check (platform in ('mac', 'iphone')),
  created_at timestamptz not null default now()
);

alter table public.early_access enable row level security;
grant select, insert, update, delete on public.early_access to service_role;
revoke all on public.early_access from anon, authenticated;
