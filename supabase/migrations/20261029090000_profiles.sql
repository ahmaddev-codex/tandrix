-- What Tandrix calls the user, shared by their phone and Mac. Server only.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to service_role;
revoke all on public.profiles from anon, authenticated;
