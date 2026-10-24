-- Procedure from the manual (T11): save the generated procedure, its parts and steps, start the
-- job's steps and record the event, in one transaction. The API validates and normalises the
-- model's draft first (@tandrix/core normalizeDraft) and supplies the ids. Server only.

-- Which manual a procedure came from (null: generic). Kept when the manual is deleted so the
-- report still shows the procedure, just without a link.
alter table public.procedures
  add column manual_id uuid references public.manuals (id) on delete set null;
create index procedures_manual_idx on public.procedures (manual_id);

create function public.save_procedure(
  p_owner_id uuid,
  p_job_id uuid,
  p_procedure jsonb, -- {id, asset_model_key, source_type, title, manual_id}
  p_parts jsonb,     -- [{id, part_number, name, qty, description}]
  p_steps jsonb,     -- [{id, order, surface, title, instruction, reason, part_spec_ids, caution,
                     --   hazard_tags, verification, expected_state, measurement, citation}]
  p_surface text,
  p_event jsonb      -- extra event payload: cited/generic counts, fixes applied
) returns public.procedures
language plpgsql security invoker set search_path = '' as $$
declare
  j public.jobs;
  p public.procedures;
  first_step uuid;
begin
  -- Lock the job: two generate requests for one job must not both succeed.
  select * into j from public.jobs where id = p_job_id and owner_id = p_owner_id for update;
  if not found then
    raise exception 'job % not found for owner', p_job_id using errcode = 'P0002';
  end if;
  if j.procedure_id is not null then
    raise exception 'job % already has a procedure', p_job_id using errcode = '23505';
  end if;

  insert into public.procedures (id, asset_model_key, source_type, author_id, status, title, manual_id)
  values (
    (p_procedure ->> 'id')::uuid,
    p_procedure ->> 'asset_model_key',
    p_procedure ->> 'source_type',
    p_owner_id,
    'draft', -- generated for this user; publishing for others is a later, reviewed step
    p_procedure ->> 'title',
    nullif(p_procedure ->> 'manual_id', '')::uuid
  )
  returning * into p;

  insert into public.part_specs (id, procedure_id, part_number, name, qty, description)
  select x.id, p.id, x.part_number, x.name, x.qty, x.description
  from jsonb_to_recordset(p_parts)
    as x(id uuid, part_number text, name text, qty integer, description text);

  insert into public.procedure_steps (
    id, procedure_id, "order", surface, title, instruction, reason, part_spec_ids, caution,
    hazard_tags, verification, expected_state, measurement, citation
  )
  select x.id, p.id, x."order", x.surface, x.title, x.instruction, x.reason,
         x.part_spec_ids, x.caution, x.hazard_tags, x.verification, x.expected_state,
         x.measurement, x.citation
  from jsonb_to_recordset(p_steps)
    as x(id uuid, "order" integer, surface text, title text, instruction text, reason text,
         part_spec_ids uuid[], caution text, hazard_tags text[], verification text,
         expected_state text, measurement jsonb, citation jsonb);

  -- Every step's parts must belong to this procedure.
  if exists (
    select 1 from public.procedure_steps s, unnest(s.part_spec_ids) as ps(id)
    where s.procedure_id = p.id
      and not exists (select 1 from public.part_specs x where x.id = ps.id and x.procedure_id = p.id)
  ) then
    raise exception 'step references a part outside the procedure' using errcode = '23503';
  end if;

  insert into public.job_steps (job_id, procedure_step_id, updated_by_surface)
  select p_job_id, s.id, p_surface from public.procedure_steps s where s.procedure_id = p.id;

  select js.id into first_step
  from public.job_steps js join public.procedure_steps s on s.id = js.procedure_step_id
  where js.job_id = p_job_id order by s."order" limit 1;

  update public.jobs set procedure_id = p.id, current_step_id = first_step where id = p_job_id;

  insert into public.events (job_id, type, surface, payload)
  values (
    p_job_id,
    'procedure_generated',
    p_surface,
    jsonb_build_object('procedure_id', p.id, 'manual_id', p.manual_id) || coalesce(p_event, '{}'::jsonb)
  );
  return p;
end;
$$;
revoke all on function public.save_procedure(uuid, uuid, jsonb, jsonb, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_procedure(uuid, uuid, jsonb, jsonb, jsonb, text, jsonb)
  to service_role;
