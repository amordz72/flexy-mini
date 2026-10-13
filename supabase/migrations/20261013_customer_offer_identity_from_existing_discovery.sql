-- Read-only customer-offer classification from canonical Station Connect discovery history.
-- Admin-only access; no new offer catalogue or duplicate discovery result store.
-- Configurable TTL lives in private settings. No USSD is initiated by this RPC.

create table if not exists private.flexy_customer_offer_discovery_settings (
  operator_key text primary key check (operator_key = 'mobilis'),
  ttl_hours integer not null default 168 check (ttl_hours between 1 and 2160),
  updated_at timestamptz not null default now()
);
insert into private.flexy_customer_offer_discovery_settings(operator_key,ttl_hours)
values ('mobilis',168)
on conflict(operator_key) do nothing;
revoke all on private.flexy_customer_offer_discovery_settings from public, anon, authenticated;

create or replace function private.flexy_discovery_presentation_group(
  p_family text,
  p_offers jsonb
)
returns text
language sql immutable
set search_path = ''
as $fn$
with families(group_name) as (
  select case
    when lower(btrim(coalesce(p_family,''))) = 'pixx' then 'PIXX'
    when lower(btrim(coalesce(p_family,''))) = 'revolution' then 'REVOLUTION'
    when lower(btrim(coalesce(p_family,''))) in ('sama','sama mix','sama talk','sama net') then 'SAMA'
    else null end
  union all
  select case
    when lower(btrim(coalesce(element->>'family',''))) = 'pixx' then 'PIXX'
    when lower(btrim(coalesce(element->>'family',''))) = 'revolution' then 'REVOLUTION'
    when lower(btrim(coalesce(element->>'family',''))) in ('sama','sama mix','sama talk','sama net') then 'SAMA'
    else null end
  from jsonb_array_elements(
    case when jsonb_typeof(p_offers)='array' then p_offers else '[]'::jsonb end
  ) as item(element)
)
select case when count(distinct group_name) = 1 then max(group_name) else null end
from families
$fn$;
revoke all on function private.flexy_discovery_presentation_group(text,jsonb) from public,anon,authenticated;

create or replace function public.flexy_mini_admin_customer_offer_identity(p_phone text)
returns table (
  lookup_status text,
  presentation_group text,
  detected_family text,
  discovery_uuid uuid,
  discovered_at timestamptz,
  valid_until timestamptz,
  ttl_hours integer,
  active_job_uuid uuid
)
language plpgsql stable security definer
set search_path = ''
as $fn$
declare
  v_phone text;
  v_ttl integer;
  v_discovery public.station_connect_offer_discoveries%rowtype;
  v_group text;
  v_job uuid;
begin
  if not private.is_shop_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  v_phone := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if v_phone !~ '^0[5-7][0-9]{8}$' then
    raise exception 'INVALID_PHONE' using errcode='22023';
  end if;
  select coalesce(s.ttl_hours,168) into v_ttl
    from private.flexy_customer_offer_discovery_settings s
    where s.operator_key='mobilis';
  v_ttl := coalesce(v_ttl,168);

  select j.job_uuid into v_job
    from public.station_connect_jobs j
    where j.phone=v_phone
      and j.operation_key='mobilis.offer.discovery'
      and j.operation_type='offer_discovery'
      and j.status in ('queued','claimed')
    order by j.created_at desc limit 1;

  if v_job is not null then
    return query select 'IN_PROGRESS'::text, null::text, null::text,
      null::uuid, null::timestamptz, null::timestamptz, v_ttl, v_job;
    return;
  end if;

  select d.* into v_discovery
  from public.station_connect_offer_discoveries d
  where d.phone=v_phone
    and d.status='success'
    and d.result_code='DISCOVERY_COMPLETE'
    and d.completed_at is not null
    and d.completed_at<=now()
    and d.completed_at >= now() - (v_ttl * interval '1 hour')
  order by d.completed_at desc, d.recorded_at desc
  limit 1;

  if not found then
    return query select 'NEEDS_DISCOVERY'::text, null::text, null::text,
      null::uuid, null::timestamptz, null::timestamptz, v_ttl, null::uuid;
    return;
  end if;

  v_group := private.flexy_discovery_presentation_group(
    v_discovery.family, v_discovery.available_offers
  );
  -- An empty or conflicting reply is UNKNOWN, never proven NO_OFFERS.
  if v_group is null then
    return query select 'UNKNOWN'::text, null::text, v_discovery.family,
      v_discovery.discovery_uuid, v_discovery.completed_at,
      v_discovery.completed_at+(v_ttl * interval '1 hour'), v_ttl, null::uuid;
    return;
  end if;

  return query select 'CLASSIFIED'::text, v_group, v_discovery.family,
    v_discovery.discovery_uuid, v_discovery.completed_at,
    v_discovery.completed_at+(v_ttl * interval '1 hour'), v_ttl, null::uuid;
end;
$fn$;
revoke all on function public.flexy_mini_admin_customer_offer_identity(text) from public,anon;
grant execute on function public.flexy_mini_admin_customer_offer_identity(text) to authenticated;
