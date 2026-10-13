-- Administrator operation history only. Never return outgoing command values or secrets.
create or replace function public.flexy_mini_admin_recent_operations(p_limit integer default 10,p_offset integer default 0)
returns table(job_uuid uuid,phone text,service text,offer_name text,amount integer,status text,
 result_code text,result_text text,created_at timestamptz,completed_at timestamptz,
 responses jsonb,total_count bigint)
language plpgsql stable security definer set search_path=''
as $$
begin
 if not private.is_shop_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_limit is null or p_limit<1 or p_limit>50 or p_offset is null or p_offset<0 then
  raise exception 'INVALID_PAGINATION' using errcode='22023';
 end if;
 return query
 select j.job_uuid,j.phone,
  case when j.operation_key='mobilis.offer.discovery' then 'استكشاف عروض'
       when j.operation_key='mobilis.offer.execute' then 'عرض'
       else 'رصيد عادي' end,
  coalesce(nullif(j.selected_offer->>'display_name',''),
    nullif(j.family,''),nullif(j.payload->>'family',''),'—'),
  j.amount,j.status,j.result_code,
  case when nullif(secret.decrypted_secret,'') is not null then
    replace(coalesce(j.result_text,''),secret.decrypted_secret,'[PIN محجوب]')
    else coalesce(j.result_text,'') end,
  j.created_at,j.completed_at,
  coalesce((
   select jsonb_agg(jsonb_build_object(
    'sequence',c.sequence,'action',c.action,'status',c.status,'error_code',c.error_code,
    'response',case when nullif(secret.decrypted_secret,'') is not null then
      replace(coalesce(c.raw_response,''),secret.decrypted_secret,'[PIN محجوب]')
      else coalesce(c.raw_response,'') end,'created_at',c.created_at
   ) order by c.sequence)
   from public.station_connect_commands c where c.job_uuid=j.job_uuid
  ),'[]'::jsonb),count(*) over()
 from public.station_connect_jobs j
 left join public.station_connect_sims si on si.sim_uuid=coalesce(j.sim_uuid,(select s.sim_uuid from public.station_connect_sessions s where s.job_uuid=j.job_uuid order by s.created_at desc limit 1))
 left join vault.decrypted_secrets secret on secret.id=si.pin_secret_id
 where j.operation_key in ('mobilis.offer.discovery','mobilis.offer.execute',
   'mobilis.flexy.arsselli.696','mobilis.flexy.ordinary')
 order by j.created_at desc,j.job_uuid desc limit p_limit offset p_offset;
end;
$$;
revoke all on function public.flexy_mini_admin_recent_operations(integer,integer) from public,anon;
grant execute on function public.flexy_mini_admin_recent_operations(integer,integer) to authenticated;

