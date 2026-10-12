-- Flexy Mini admin-only read view of existing Mobilis Sama offer discoveries.
-- Uses Station Connect canonical job history. Never submits commands or alters offers.
create or replace function public.flexy_mini_admin_sama_offer_discoveries(p_limit integer default 10)
returns table(
  job_uuid uuid,
  status text,
  family text,
  result_code text,
  available_offers jsonb,
  phone_masked text,
  created_at timestamptz,
  completed_at timestamptz
)
language plpgsql stable security definer set search_path=''
as $function$
begin
  if not private.is_shop_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;

  return query
  select
    j.job_uuid,
    j.status,
    j.family,
    j.result_code,
    coalesce(j.available_offers,'[]'::jsonb),
    case when j.phone ~ '^0[5-7][0-9]{8}$'
      then left(j.phone,3)||'*****'||right(j.phone,2)
      else null end,
    j.created_at,
    j.completed_at
  from public.station_connect_jobs j
  where j.operation_key='mobilis.offer.discovery'
    and j.operation_type='offer_discovery'
    and j.target_sim_type='mobilis-sama'
  order by j.created_at desc
  limit least(greatest(coalesce(p_limit,10),1),20);
end;
$function$;
revoke all on function public.flexy_mini_admin_sama_offer_discoveries(integer) from public,anon;
grant execute on function public.flexy_mini_admin_sama_offer_discoveries(integer) to authenticated;
