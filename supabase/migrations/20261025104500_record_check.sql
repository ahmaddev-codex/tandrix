-- Step check by photo (T15): save the check and the step's new state together. The API applies
-- the step rules (@tandrix/core transitionStep, "check" event) first. Server only.
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
) returns public.checks
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
  return c;
end;
$$;
revoke all on function public.record_check(uuid, uuid, uuid, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.record_check(uuid, uuid, uuid, text, text, text, text, jsonb, text)
  to service_role;
