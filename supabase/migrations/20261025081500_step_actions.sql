-- Step actions (T13): the API applies the step rules (@tandrix/core transitionStep) and saves the
-- result here, one transaction each. Server only.

-- Confirm one safety gate on a step. Confirming twice is harmless: the first confirmation stands.
create function public.confirm_safety_gate(
  p_owner_id uuid,
  p_job_step_id uuid,
  p_gate text,
  p_surface text
) returns public.safety_confirmations
language plpgsql security invoker set search_path = '' as $$
declare
  js public.job_steps;
  c public.safety_confirmations;
begin
  select s.* into js
  from public.job_steps s join public.jobs j on j.id = s.job_id
  where s.id = p_job_step_id and j.owner_id = p_owner_id;
  if not found then
    raise exception 'step % not found for owner', p_job_step_id using errcode = 'P0002';
  end if;

  insert into public.safety_confirmations (job_step_id, gate, confirmed_by, surface)
  values (p_job_step_id, p_gate, p_owner_id, p_surface)
  on conflict (job_step_id, gate) do nothing
  returning * into c;

  if c.id is null then
    select * into c from public.safety_confirmations where job_step_id = p_job_step_id and gate = p_gate;
  else
    insert into public.events (job_id, type, surface, payload)
    values (js.job_id, 'safety_confirmed', p_surface,
            jsonb_build_object('job_step_id', p_job_step_id, 'gate', p_gate));
  end if;
  return c;
end;
$$;
revoke all on function public.confirm_safety_gate(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_safety_gate(uuid, uuid, text, text) to service_role;

-- Save a step's new state. p_from_status is the status the rules were applied to: if the step
-- changed since (another device acted), nothing is written and the caller re-reads and retries.
create function public.apply_step_transition(
  p_owner_id uuid,
  p_job_step_id uuid,
  p_from_status text,
  p_to jsonb,      -- {status, started_at, status_evidence_id, note}
  p_surface text,
  p_event jsonb    -- {action, ...} recorded with the status change
) returns public.job_steps
language plpgsql security invoker set search_path = '' as $$
declare
  js public.job_steps;
begin
  update public.job_steps s
  set status = p_to ->> 'status',
      started_at = (p_to ->> 'started_at')::timestamptz,
      status_evidence_id = (p_to ->> 'status_evidence_id')::uuid,
      note = p_to ->> 'note',
      updated_by_surface = p_surface
  from public.jobs j
  where s.id = p_job_step_id and j.id = s.job_id and j.owner_id = p_owner_id
    and s.status = p_from_status
  returning s.* into js;

  if js.id is null then
    if exists (select 1 from public.job_steps s join public.jobs j on j.id = s.job_id
               where s.id = p_job_step_id and j.owner_id = p_owner_id) then
      raise exception 'step % changed since it was read', p_job_step_id using errcode = 'P0003';
    end if;
    raise exception 'step % not found for owner', p_job_step_id using errcode = 'P0002';
  end if;

  -- The job follows the step being worked on.
  if js.status = 'in_progress' then
    update public.jobs set current_step_id = js.id, active_surface = p_surface where id = js.job_id;
  end if;

  insert into public.events (job_id, type, surface, payload)
  values (js.job_id, 'step_status_changed', p_surface,
          jsonb_build_object('job_step_id', js.id, 'from', p_from_status, 'to', js.status)
            || coalesce(p_event, '{}'::jsonb));
  return js;
end;
$$;
revoke all on function public.apply_step_transition(uuid, uuid, text, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_step_transition(uuid, uuid, text, jsonb, text, jsonb)
  to service_role;
