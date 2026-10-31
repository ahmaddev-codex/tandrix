-- Writing a job's steps in the background: one row per job, so a dropped connection or a reopened
-- app finds the run instead of starting (and paying for) another. Server only.
create table public.procedure_runs (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  status text not null check (status in ('running', 'done', 'failed')),
  message text,
  cited_steps integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.procedure_runs enable row level security;
grant select, insert, update, delete on public.procedure_runs to service_role;
revoke all on public.procedure_runs from anon, authenticated;

-- Claims the job's run: true when the caller should do the work, false when one is already going.
-- A run older than p_stale_seconds was lost (a restart or deploy), so it can be claimed again.
create function public.claim_procedure_run(p_job_id uuid, p_stale_seconds integer)
returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  claimed boolean;
begin
  insert into public.procedure_runs (job_id, status)
  values (p_job_id, 'running')
  on conflict (job_id) do update
    set status = 'running', message = null, cited_steps = null,
        started_at = now(), finished_at = null
    where public.procedure_runs.status <> 'running'
       or public.procedure_runs.started_at < now() - make_interval(secs => p_stale_seconds)
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;
revoke all on function public.claim_procedure_run(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_procedure_run(uuid, integer) to service_role;
