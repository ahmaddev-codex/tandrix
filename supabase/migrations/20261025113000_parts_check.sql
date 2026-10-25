-- Parts check (T16): one photo of the laid-out parts, matched to the procedure's parts list.
-- Missing parts block the steps that need them; a later check or a correction that finds them
-- lifts only those blocks. Server only.

-- Why a step is blocked: only blocks the parts check placed are lifted by it.
alter table public.job_steps
  add column blocked_by text check (blocked_by in ('parts', 'other')),
  add constraint job_steps_blocked_by_status check (blocked_by is null or status = 'blocked');

-- Step changes made by hand (skip a blocked step) clear blocked_by, so the constraint above holds.
create or replace function public.apply_step_transition(
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
      -- Leaving "blocked" (skip, unblock by hand) clears why it was blocked.
      blocked_by = case when p_to ->> 'status' = 'blocked' then s.blocked_by end,
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

-- Block and unblock steps for a parts result, each guarded against a concurrent change.
create function public.apply_parts_blocking(
  p_owner_id uuid,
  p_job_id uuid,
  p_block jsonb,    -- [{job_step_id, from_status, note}]
  p_unblock jsonb,  -- [{job_step_id}]
  p_surface text
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  b record;
  n integer;
begin
  for b in select * from jsonb_to_recordset(p_block) as x(job_step_id uuid, from_status text, note text) loop
    update public.job_steps s
    set status = 'blocked', blocked_by = 'parts', note = b.note, updated_by_surface = p_surface
    from public.jobs j
    where s.id = b.job_step_id and j.id = s.job_id and j.id = p_job_id and j.owner_id = p_owner_id
      and s.status = b.from_status;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'step % changed since it was read', b.job_step_id using errcode = 'P0003';
    end if;
    insert into public.events (job_id, type, surface, payload)
    values (p_job_id, 'step_status_changed', p_surface,
            jsonb_build_object('job_step_id', b.job_step_id, 'from', b.from_status, 'to', 'blocked',
                               'action', 'parts_check'));
  end loop;

  for b in select * from jsonb_to_recordset(p_unblock) as x(job_step_id uuid) loop
    update public.job_steps s
    set status = 'todo', blocked_by = null, note = null, started_at = null,
        status_evidence_id = null, updated_by_surface = p_surface
    from public.jobs j
    where s.id = b.job_step_id and j.id = s.job_id and j.id = p_job_id and j.owner_id = p_owner_id
      and s.status = 'blocked' and s.blocked_by = 'parts';
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'step % changed since it was read', b.job_step_id using errcode = 'P0003';
    end if;
    insert into public.events (job_id, type, surface, payload)
    values (p_job_id, 'step_status_changed', p_surface,
            jsonb_build_object('job_step_id', b.job_step_id, 'from', 'blocked', 'to', 'todo',
                               'action', 'parts_check'));
  end loop;
end;
$$;
revoke all on function public.apply_parts_blocking(uuid, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_parts_blocking(uuid, uuid, jsonb, jsonb, text) to service_role;

create function public.save_parts_check(
  p_owner_id uuid,
  p_job_id uuid,
  p_evidence_id uuid,
  p_detections jsonb, -- [{id, label, part_spec_id, box, confidence}]
  p_results jsonb,    -- [{partSpecId, status, detectionIds}]
  p_block jsonb,
  p_unblock jsonb,
  p_surface text
) returns public.parts_checks
language plpgsql security invoker set search_path = '' as $$
declare
  pc public.parts_checks;
begin
  if not exists (
    select 1 from public.evidence e join public.jobs j on j.id = e.job_id
    where e.id = p_evidence_id and j.id = p_job_id and j.owner_id = p_owner_id
      and e.uploaded_at is not null and e.deleted_at is null
  ) then
    raise exception 'photo % not found on job', p_evidence_id using errcode = 'P0002';
  end if;

  insert into public.detections (id, evidence_id, label, part_spec_id, box, confidence)
  select x.id, p_evidence_id, x.label, x.part_spec_id, x.box, x.confidence
  from jsonb_to_recordset(p_detections)
    as x(id uuid, label text, part_spec_id uuid, box jsonb, confidence real);

  insert into public.parts_checks (job_id, evidence_ids, results)
  values (p_job_id, array[p_evidence_id], p_results)
  returning * into pc;

  perform public.apply_parts_blocking(p_owner_id, p_job_id, p_block, p_unblock, p_surface);

  insert into public.events (job_id, type, surface, payload)
  values (p_job_id, 'parts_checked', p_surface,
          jsonb_build_object('parts_check_id', pc.id, 'evidence_id', p_evidence_id,
                             'missing', (select count(*) from jsonb_array_elements(p_results) r
                                         where r ->> 'status' = 'missing')));
  return pc;
end;
$$;
revoke all on function public.save_parts_check(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.save_parts_check(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text)
  to service_role;

-- A user's correction to one part's status: the whole result is replaced and blocking re-applied.
create function public.correct_parts_check(
  p_owner_id uuid,
  p_parts_check_id uuid,
  p_results jsonb,
  p_block jsonb,
  p_unblock jsonb,
  p_surface text
) returns public.parts_checks
language plpgsql security invoker set search_path = '' as $$
declare
  pc public.parts_checks;
begin
  update public.parts_checks c
  set results = p_results
  from public.jobs j
  where c.id = p_parts_check_id and j.id = c.job_id and j.owner_id = p_owner_id
  returning c.* into pc;
  if pc.id is null then
    raise exception 'parts check % not found for owner', p_parts_check_id using errcode = 'P0002';
  end if;
  perform public.apply_parts_blocking(p_owner_id, pc.job_id, p_block, p_unblock, p_surface);
  return pc;
end;
$$;
revoke all on function public.correct_parts_check(uuid, uuid, jsonb, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.correct_parts_check(uuid, uuid, jsonb, jsonb, jsonb, text)
  to service_role;
