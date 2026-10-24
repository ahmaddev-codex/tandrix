-- Identify the equipment (T9): save the confirmed asset, link it to the job and record how the
-- values were produced, in one transaction. Only the API (service_role) may call it.

create function public.set_job_asset(
  p_owner_id uuid,
  p_job_id uuid,
  p_category text,
  p_make text,
  p_model text,
  p_serial text,
  p_nameplate_evidence_id uuid,
  p_source text,
  p_confidence real
) returns public.assets
language plpgsql security invoker set search_path = '' as $$
declare
  a public.assets;
begin
  if p_source not in ('model', 'model_edited', 'manual') then
    raise exception 'invalid source %', p_source using errcode = '22023';
  end if;
  insert into public.assets (owner_id, category, make, model, serial, nameplate_evidence_id)
  values (p_owner_id, p_category, p_make, p_model, nullif(p_serial, ''), p_nameplate_evidence_id)
  returning * into a;
  update public.jobs set asset_id = a.id where id = p_job_id and owner_id = p_owner_id;
  if not found then
    raise exception 'job % not found for owner', p_job_id using errcode = 'P0002';
  end if;
  insert into public.events (job_id, type, surface, payload)
  values (
    p_job_id,
    'asset_identified',
    'phone',
    jsonb_strip_nulls(jsonb_build_object('asset_id', a.id, 'source', p_source, 'confidence', p_confidence))
  );
  return a;
end;
$$;
revoke all on function public.set_job_asset(uuid, uuid, text, text, text, text, uuid, text, real)
  from public, anon, authenticated;
grant execute on function public.set_job_asset(uuid, uuid, text, text, text, text, uuid, text, real)
  to service_role;
