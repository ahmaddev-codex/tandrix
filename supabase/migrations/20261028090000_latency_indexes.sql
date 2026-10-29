-- Latency: index the confirmation and event lookups the API runs on hot paths, push the
-- latest-check-per-step grouping into SQL, and return the updated step from record_check so
-- the API stops re-reading it.
create index safety_confirmations_step_idx on public.safety_confirmations (job_step_id);
create index events_job_type_idx on public.events (job_id, type);

create function public.latest_checks_for_job(p_job_id uuid)
returns table (job_step_id uuid, evidence_id uuid, result text, reason text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select distinct on (c.job_step_id) c.job_step_id, c.evidence_id, c.result, c.reason, c.created_at
  from public.checks c join public.job_steps s on s.id = c.job_step_id
  where s.job_id = p_job_id
  order by c.job_step_id, c.created_at desc;
$$;
revoke all on function public.latest_checks_for_job(uuid)
  from public, anon, authenticated;
grant execute on function public.latest_checks_for_job(uuid)
  to service_role;

-- record_check now returns the check and the updated step together. Returning a new type
-- needs a drop first; only the API calls it.
drop function public.record_check(uuid, uuid, uuid, text, text, text, text, jsonb, text);
create function public.record_check(
  p_owner_id uuid,
  p_job_step_id uuid,
  p_evidence_id uuid,
  p_result text,
  p_reason text,
  p_what_to_show_next text,
  p_from_status text,
  p_to jsonb,      -- {status, started_at, status_evidence_id, note}
  p_surface text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  c public.checks;
  js public.job_steps;
begin
  -- The photo must be on the same job as the step.
  if not exists (
    select 1 from public.evidence e
    join public.job_steps s on s.job_id = e.job_id
    join public.jobs j on j.id = s.job_id
    where e.id = p_evidence_id and s.id = p_job_step_id and j.owner_id = p_owner_id
      and e.uploaded_at is not null and e.deleted_at is null
  ) then
    raise exception 'photo % not found on the step''s job', p_evidence_id using errcode = 'P0002';
  end if;

  insert into public.checks (job_step_id, evidence_id, result, reason, what_to_show_next)
  values (p_job_step_id, p_evidence_id, p_result, p_reason, nullif(p_what_to_show_next, ''))
  returning * into c;

  -- Same guarded save as any step change: fails if another device changed the step meanwhile.
  js := public.apply_step_transition(
    p_owner_id, p_job_step_id, p_from_status, p_to, p_surface,
    jsonb_build_object('action', 'check', 'check_id', c.id, 'result', p_result)
  );

  insert into public.events (job_id, type, surface, payload)
  values (js.job_id, 'check_recorded', p_surface,
          jsonb_build_object('job_step_id', js.id, 'check_id', c.id, 'evidence_id', p_evidence_id,
                             'result', p_result));
  return jsonb_build_object('check', to_jsonb(c), 'step', to_jsonb(js));
end;
$$;
revoke all on function public.record_check(uuid, uuid, uuid, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.record_check(uuid, uuid, uuid, text, text, text, text, jsonb, text)
  to service_role;
