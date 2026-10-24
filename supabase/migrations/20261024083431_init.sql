-- Tandrix initial schema (Architecture §4). Shapes mirror @tandrix/contracts; enum values and
-- length limits are kept in step by test/schema-drift.test.ts in apps/api.
--
-- Access model:
--   * Clients (phone, Mac, web) READ their own rows directly, including over Realtime.
--   * All WRITES go through the Tandrix API using the secret key, which checks ownership and
--     applies the step-status and safety rules in @tandrix/core. Clients have no insert,
--     update or delete policies, so they can't set a step to verified or skip a safety gate.
--   * Manuals and published procedures are shared reference material, readable by any
--     signed-in user.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference material
-- ---------------------------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('equipment', 'software')),
  make text not null check (char_length(make) between 1 and 120),
  model text not null check (char_length(model) between 1 and 120),
  serial text check (char_length(serial) <= 120),
  nameplate_evidence_id uuid,
  created_at timestamptz not null default now()
);
create index assets_owner_idx on public.assets (owner_id);

create table public.manuals (
  id uuid primary key default gen_random_uuid(),
  asset_model_key text not null check (char_length(asset_model_key) between 1 and 260),
  source_type text not null check (source_type in ('search', 'upload')),
  source_url text check (char_length(source_url) <= 2000),
  storage_key text not null check (char_length(storage_key) between 1 and 512),
  page_count integer not null check (page_count between 1 and 5000),
  created_at timestamptz not null default now()
);
create index manuals_model_key_idx on public.manuals (asset_model_key);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  asset_model_key text not null check (char_length(asset_model_key) between 1 and 260),
  source_type text not null check (source_type in ('manual', 'expert_recording', 'generic')),
  author_id uuid references auth.users (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  version integer not null default 1 check (version >= 1),
  title text not null check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now()
);
create index procedures_model_key_idx on public.procedures (asset_model_key);

create table public.part_specs (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  part_number text check (char_length(part_number) <= 60),
  name text not null check (char_length(name) between 1 and 120),
  qty integer not null check (qty between 1 and 999),
  description text check (char_length(description) <= 400)
);
create index part_specs_procedure_idx on public.part_specs (procedure_id);

create table public.procedure_steps (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  "order" integer not null check ("order" between 1 and 500),
  surface text not null check (surface in ('physical', 'desktop')),
  title text not null check (char_length(title) between 1 and 120),
  instruction text not null check (char_length(instruction) between 1 and 600),
  reason text check (char_length(reason) <= 600),
  part_spec_ids uuid[] not null default '{}' check (cardinality(part_spec_ids) <= 20),
  caution text check (char_length(caution) <= 400),
  hazard_tags text[] not null default '{}' check (
    cardinality(hazard_tags) <= 7
    and hazard_tags <@ array['electrical_isolation', 'pressure', 'rotating_parts', 'hot_surface',
                             'heavy_lift', 'chemical', 'live_electrical']::text[]
  ),
  verification text not null check (verification in ('photo', 'screen', 'user_confirm', 'measurement')),
  expected_state text not null check (char_length(expected_state) between 1 and 600),
  measurement jsonb,
  citation jsonb not null,
  reference_image_key text check (char_length(reference_image_key) <= 512),
  unique (procedure_id, "order"),
  check (verification <> 'measurement' or measurement is not null),
  check (citation ->> 'kind' in ('manual', 'expert_recording', 'generic'))
);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete set null,
  procedure_id uuid references public.procedures (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  status text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  current_step_id uuid,
  active_surface text not null check (active_surface in ('phone', 'glasses', 'desktop')),
  control_mode text not null default 'show' check (control_mode in ('show', 'do')),
  language text not null default 'en' check (language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_owner_created_idx on public.jobs (owner_id, created_at desc);
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  procedure_step_id uuid not null references public.procedure_steps (id) on delete restrict,
  status text not null default 'todo' check (
    status in ('todo', 'in_progress', 'needs_attention', 'user_confirmed', 'verified', 'blocked', 'skipped')
  ),
  status_evidence_id uuid,
  started_at timestamptz,
  note text check (char_length(note) <= 400),
  updated_at timestamptz not null default now(),
  updated_by_surface text not null check (updated_by_surface in ('phone', 'glasses', 'desktop')),
  unique (job_id, procedure_step_id),
  -- Verified always has evidence behind it.
  check (status <> 'verified' or status_evidence_id is not null)
);
create index job_steps_job_idx on public.job_steps (job_id);
create trigger job_steps_updated_at before update on public.job_steps
  for each row execute function public.set_updated_at();

alter table public.jobs
  add constraint jobs_current_step_fk foreign key (current_step_id)
  references public.job_steps (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Evidence and results
-- ---------------------------------------------------------------------------

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  job_step_id uuid references public.job_steps (id) on delete set null,
  kind text not null check (kind in ('photo', 'screenshot', 'video', 'audio', 'document')),
  surface text not null check (surface in ('phone', 'glasses', 'desktop')),
  storage_key text not null check (char_length(storage_key) between 1 and 512),
  mime_type text not null check (char_length(mime_type) between 1 and 100),
  byte_size bigint not null check (byte_size >= 1),
  width integer check (width >= 1),
  height integer check (height >= 1),
  captured_at timestamptz not null,
  deleted_at timestamptz
);
create index evidence_job_idx on public.evidence (job_id);

alter table public.assets
  add constraint assets_nameplate_evidence_fk foreign key (nameplate_evidence_id)
  references public.evidence (id) on delete set null;
alter table public.job_steps
  add constraint job_steps_status_evidence_fk foreign key (status_evidence_id)
  references public.evidence (id) on delete restrict;

create table public.detections (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  part_spec_id uuid references public.part_specs (id) on delete set null,
  box jsonb not null,
  mask_key text check (char_length(mask_key) <= 512),
  confidence real not null check (confidence between 0 and 1),
  confirmed_by_user boolean,
  corrected_label text check (char_length(corrected_label) <= 120)
);
create index detections_evidence_idx on public.detections (evidence_id);

create table public.checks (
  id uuid primary key default gen_random_uuid(),
  job_step_id uuid not null references public.job_steps (id) on delete cascade,
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  result text not null check (result in ('pass', 'fail', 'not_verifiable')),
  reason text not null check (char_length(reason) between 1 and 600),
  what_to_show_next text check (char_length(what_to_show_next) <= 300),
  created_at timestamptz not null default now()
);
create index checks_job_step_idx on public.checks (job_step_id);

create table public.parts_checks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  evidence_ids uuid[] not null check (cardinality(evidence_ids) between 1 and 4),
  results jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index parts_checks_job_idx on public.parts_checks (job_id);

create table public.safety_confirmations (
  id uuid primary key default gen_random_uuid(),
  job_step_id uuid not null references public.job_steps (id) on delete cascade,
  gate text not null check (
    gate in ('isolate_power', 'release_pressure', 'lock_rotation', 'cool_down', 'lifting_plan', 'chemical_ppe')
  ),
  confirmed_by uuid not null references auth.users (id) on delete cascade,
  surface text not null check (surface in ('phone', 'glasses', 'desktop')),
  confirmed_at timestamptz not null default now(),
  unique (job_step_id, gate)
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) between 32 and 128),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index share_links_job_idx on public.share_links (job_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  type text not null check (type in (
    'job_created', 'asset_identified', 'manual_attached', 'procedure_generated', 'parts_checked',
    'step_status_changed', 'safety_confirmed', 'check_recorded', 'handoff', 'control_mode_changed',
    'desktop_action_executed', 'desktop_action_blocked', 'evidence_deleted'
  )),
  surface text check (surface in ('phone', 'glasses', 'desktop')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_job_created_idx on public.events (job_id, created_at);

-- ---------------------------------------------------------------------------
-- API write functions: one transaction per operation. Only the server (service_role) may call.
-- ---------------------------------------------------------------------------

create function public.create_job(
  p_owner_id uuid,
  p_title text,
  p_asset_id uuid,
  p_language text,
  p_surface text
) returns public.jobs
language plpgsql security invoker set search_path = '' as $$
declare
  j public.jobs;
begin
  insert into public.jobs (owner_id, title, asset_id, language, active_surface)
  values (p_owner_id, p_title, p_asset_id, p_language, p_surface)
  returning * into j;
  insert into public.events (job_id, type, surface, payload)
  values (j.id, 'job_created', p_surface, '{}'::jsonb);
  return j;
end;
$$;
revoke all on function public.create_job(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_job(uuid, text, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security: read-only for clients
-- ---------------------------------------------------------------------------

alter table public.assets enable row level security;
alter table public.manuals enable row level security;
alter table public.procedures enable row level security;
alter table public.part_specs enable row level security;
alter table public.procedure_steps enable row level security;
alter table public.jobs enable row level security;
alter table public.job_steps enable row level security;
alter table public.evidence enable row level security;
alter table public.detections enable row level security;
alter table public.checks enable row level security;
alter table public.parts_checks enable row level security;
alter table public.safety_confirmations enable row level security;
alter table public.share_links enable row level security;
alter table public.events enable row level security;

-- True when the signed-in user owns the job. SECURITY DEFINER avoids recursive RLS lookups;
-- search_path is pinned so it can't be hijacked.
create function public.owns_job(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobs j where j.id = target and j.owner_id = (select auth.uid()));
$$;
revoke all on function public.owns_job(uuid) from public, anon;
grant execute on function public.owns_job(uuid) to authenticated;

create policy "Owners read their assets" on public.assets
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "Signed-in users read manuals" on public.manuals
  for select to authenticated using (true);

create policy "Read published procedures and your own drafts" on public.procedures
  for select to authenticated using (status = 'published' or author_id = (select auth.uid()));

create policy "Read parts of visible procedures" on public.part_specs
  for select to authenticated using (
    exists (select 1 from public.procedures p where p.id = procedure_id
            and (p.status = 'published' or p.author_id = (select auth.uid())))
  );

create policy "Read steps of visible procedures" on public.procedure_steps
  for select to authenticated using (
    exists (select 1 from public.procedures p where p.id = procedure_id
            and (p.status = 'published' or p.author_id = (select auth.uid())))
  );

create policy "Owners read their jobs" on public.jobs
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their job steps" on public.job_steps
  for select to authenticated using (public.owns_job(job_id));

create policy "Owners read their evidence" on public.evidence
  for select to authenticated using (deleted_at is null and public.owns_job(job_id));

create policy "Owners read detections on their evidence" on public.detections
  for select to authenticated using (
    exists (select 1 from public.evidence e where e.id = evidence_id and public.owns_job(e.job_id))
  );

create policy "Owners read their checks" on public.checks
  for select to authenticated using (
    exists (select 1 from public.job_steps s where s.id = job_step_id and public.owns_job(s.job_id))
  );

create policy "Owners read their parts checks" on public.parts_checks
  for select to authenticated using (public.owns_job(job_id));

create policy "Owners read their safety confirmations" on public.safety_confirmations
  for select to authenticated using (
    exists (select 1 from public.job_steps s where s.id = job_step_id and public.owns_job(s.job_id))
  );

create policy "Owners read their share links" on public.share_links
  for select to authenticated using (public.owns_job(job_id));

create policy "Owners read their events" on public.events
  for select to authenticated using (public.owns_job(job_id));

-- Table privileges. Supabase no longer grants the API roles anything on new tables, so grant
-- exactly what the access model needs. Every later migration that adds a table must do the same.
--   service_role (the Tandrix API, server only): read and write; bypasses RLS.
--   authenticated (client apps): read only; RLS above limits rows to the user's own.
--   anon (signed out): nothing.
grant select, insert, update, delete on all tables in schema public to service_role;
revoke all on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Realtime: job and step changes drive the phone ⇄ Mac handoff (T22). RLS applies.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.jobs, public.job_steps;

-- ---------------------------------------------------------------------------
-- Storage: private buckets; the API issues short-lived signed URLs.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('evidence', 'evidence', false, 314572800,
   array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime',
         'audio/wav', 'audio/mp4', 'audio/mpeg', 'application/pdf']),
  ('manuals', 'manuals', false, 62914560, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
