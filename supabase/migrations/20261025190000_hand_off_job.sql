-- Handoff (T22): one device sends the job to another. The job's active device and current step
-- change together with a handoff event; Realtime on public.jobs tells the other device. Server only.
create function public.hand_off_job(
  p_owner_id uuid,
  p_job_id uuid,
  p_to text,            -- the device taking over
  p_job_step_id uuid,   -- the step to open there; null keeps the current step
  p_by text             -- the device that handed off, for the event
) returns public.jobs
language plpgsql security invoker set search_path = '' as $$
declare
  v_from text;
  j public.jobs;
begin
  select active_surface into v_from from public.jobs
  where id = p_job_id and owner_id = p_owner_id
  for update;
  if v_from is null then
    raise exception 'job % not found for owner', p_job_id using errcode = 'P0002';
  end if;
  if p_job_step_id is not null and not exists (
    select 1 from public.job_steps where id = p_job_step_id and job_id = p_job_id
  ) then
    raise exception 'step % not in job %', p_job_step_id, p_job_id using errcode = 'P0002';
  end if;

  update public.jobs
  set active_surface = p_to,
      current_step_id = coalesce(p_job_step_id, current_step_id)
  where id = p_job_id
  returning * into j;

  insert into public.events (job_id, type, surface, payload)
  values (p_job_id, 'handoff', p_by,
          jsonb_build_object('from', v_from, 'to', p_to)
            || case when p_job_step_id is null then '{}'::jsonb
                    else jsonb_build_object('job_step_id', p_job_step_id) end);
  return j;
end;
$$;

revoke all on function public.hand_off_job(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.hand_off_job(uuid, uuid, text, uuid, text) to service_role;

-- The Mac learns of a handoff from its event (who sent it, to where, which step) rather than from
-- jobs.active_surface, which also changes when the Mac itself starts a step. Owners read only
-- their events (RLS), and event payloads never hold raw media or transcripts.
alter publication supabase_realtime add table public.events;
