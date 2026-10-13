-- Flexy Mini specific financial entry: bind the recipient's verified offer group
-- to the selected canonical offer *inside the server-side transaction*.
-- Reuse the established Station Connect execution backend; do not edit MyTool functions.
-- Adding this function performs no USSD, inserts no job and changes no balances.

create or replace function public.flexy_mini_admin_create_verified_offer_execute(
  p_phone text,
  p_offer_uuid uuid,
  p_discovery_uuid uuid,
  p_idempotency_key text,
  p_station_uuid uuid
)
returns table(job_uuid uuid,station_uuid uuid,status text,reused boolean)
language plpgsql security definer set search_path=''
as $fn$
declare
  v_phone text;
  v_key text;
  v_offer public.flexy_offer_catalog%rowtype;
  v_discovery public.station_connect_offer_discoveries%rowtype;
  v_group text;
  v_allowed boolean;
  v_ttl integer;
  v_existing private.mytool_request_idempotency%rowtype;
  v_job public.station_connect_jobs%rowtype;
  v_result record;
begin
  if not private.is_shop_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  v_phone := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if v_phone !~ '^0[5-7][0-9]{8}$' then
    raise exception 'INVALID_PHONE' using errcode='22023';
  end if;
  if p_station_uuid is null or p_offer_uuid is null or p_discovery_uuid is null then
    raise exception 'STATION_OFFER_DISCOVERY_REQUIRED' using errcode='22023';
  end if;
  v_key:=nullif(btrim(coalesce(p_idempotency_key,'')),'');
  if v_key is null or length(v_key)<8 or length(v_key)>200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode='22023';
  end if;
  select * into v_offer
  from public.flexy_offer_catalog c
  where c.offer_uuid=p_offer_uuid and c.operator='mobilis'
    and c.active=true and c.execution_enabled=true
    and c.amount>=500 and c.network_index is not null;
  if not found then
    raise exception 'OFFER_NOT_EXECUTABLE' using errcode='P0002';
  end if;

  -- Strong idempotency: never return an earlier job for another phone/offer/station.
  -- Advisory lock uses exactly the existing v2 scope; no duplicate racing creation.
  perform pg_advisory_xact_lock(hashtextextended('mytool:offer:'||v_key,0));
  select * into v_existing
  from private.mytool_request_idempotency i
  where i.source_app='mytool' and i.request_key=v_key;
  if found then
    if v_existing.operation_key <> 'mobilis.offer.execute' or v_existing.job_uuid is null then
      raise exception 'INVALID_PREVIOUS_IDEMPOTENCY_REQUEST' using errcode='23505';
    end if;
    select * into v_job from public.station_connect_jobs j
    where j.job_uuid=v_existing.job_uuid;
    if not found or v_job.phone is distinct from v_phone
      or v_job.amount is distinct from v_offer.amount
      or v_job.station_uuid is distinct from p_station_uuid
      or (v_job.payload->>'offer_uuid') is distinct from p_offer_uuid::text then
      raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH' using errcode='23505';
    end if;
    return query select v_job.job_uuid,v_job.station_uuid,v_job.status,true;
    return;
  end if;

  select coalesce(s.ttl_hours,168) into v_ttl
  from private.flexy_customer_offer_discovery_settings s
  where s.operator_key='mobilis';
  v_ttl:=coalesce(v_ttl,168);

  -- Exact latest successful, completed, still-valid discovery for THIS recipient.
  -- Old, failed, malformed or conflicting results never authorize a new financial job.
  select d.* into v_discovery
  from public.station_connect_offer_discoveries d
  where d.phone=v_phone and d.status='success'
    and d.result_code='DISCOVERY_COMPLETE' and d.completed_at is not null
    and d.completed_at<=now()
    and d.completed_at>=now()-(v_ttl*interval '1 hour')
  order by d.completed_at desc,d.recorded_at desc
  limit 1;
  if not found or v_discovery.discovery_uuid is distinct from p_discovery_uuid then
    raise exception 'VERIFIED_RECIPIENT_DISCOVERY_REQUIRED' using errcode='P0002';
  end if;
  v_group := private.flexy_discovery_presentation_group(
    v_discovery.family,v_discovery.available_offers
  );
  v_allowed:=case v_group
    when 'SAMA' then lower(v_offer.family) in ('sama mix','sama talk','sama net')
    when 'PIXX' then lower(v_offer.family)='pixx'
    when 'REVOLUTION' then lower(v_offer.family)='revolution'
    else false end;
  if not coalesce(v_allowed,false) then
    raise exception 'OFFER_NOT_IN_RECIPIENT_GROUP' using errcode='22023';
  end if;

  -- Existing Station Connect remains the sole owner of routing, balance,
  -- approved SIM, session creation, PIN resolution and financial lifecycle.
  select * into v_result from public.station_connect_admin_create_offer_execute_v2(
    v_phone,v_offer.family,v_offer.network_index,v_offer.amount,v_key,p_station_uuid
  );
  if v_result.job_uuid is null then
    raise exception 'EXECUTE_JOB_NOT_CREATED' using errcode='P0002';
  end if;
  return query
  select v_result.job_uuid,v_result.station_uuid,v_result.status,
         coalesce(v_result.reused,false);
end;
$fn$;

revoke all on function public.flexy_mini_admin_create_verified_offer_execute(text,uuid,uuid,text,uuid)
  from public,anon;
grant execute on function public.flexy_mini_admin_create_verified_offer_execute(text,uuid,uuid,text,uuid)
  to authenticated;
