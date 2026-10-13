-- Admin diagnostics only: makes live Sama readiness explainable.
-- No network commands; no changes to SIM registry, PIN, balance or any MyTool data.
create or replace function public.flexy_mini_admin_sama_readiness()
returns table(
 station_uuid uuid,
 station_name text,
 station_online boolean,
 agent_version text,
 sim_uuid uuid,
 sim_type text,
 mobilis_network boolean,
 modem_online boolean,
 sim_online boolean,
 has_service_pin boolean,
 flexy_approved boolean,
 balance_initialized boolean,
 operational_balance numeric,
 balance_reconciliation_due boolean,
 discover_ready boolean,
 execute_prerequisites_ready boolean
)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if not private.is_shop_admin() then
  raise exception 'ADMIN_REQUIRED' using errcode='42501';
 end if;
 return query
 select st.station_uuid,st.computer_name,
        (st.status='approved' and st.last_seen_at>=now()-interval '90 seconds'),
        st.agent_version,
        si.sim_uuid,si.sim_type,
        coalesce(si.imsi like '60301%',false),
        m.last_seen_at>=now()-interval '90 seconds',
        si.last_seen_at>=now()-interval '90 seconds',
        si.pin_secret_id is not null,
        coalesce(si.flexy_approved,false),
        ob.baseline_amount is not null,
        ob.operational_balance,
        coalesce(ob.reconciliation_due,false),
        (
          st.status='approved' and st.last_seen_at>=now()-interval '90 seconds'
          and m.last_seen_at>=now()-interval '90 seconds'
          and si.last_seen_at>=now()-interval '90 seconds'
          and si.sim_type='mobilis-sama' and si.imsi like '60301%'
          and si.pin_secret_id is not null
        ),
        (
          st.status='approved' and st.last_seen_at>=now()-interval '90 seconds'
          and m.last_seen_at>=now()-interval '90 seconds'
          and si.last_seen_at>=now()-interval '90 seconds'
          and si.sim_type='mobilis-sama' and si.imsi like '60301%'
          and si.pin_secret_id is not null and si.flexy_approved=true
          and ob.baseline_amount is not null and ob.operational_balance>0
        )
 from public.station_connect_stations st
 join public.station_connect_modems m on m.station_uuid=st.station_uuid
 join public.station_connect_sims si on si.modem_uuid=m.modem_uuid
 left join lateral private.station_connect_operational_balance(
   si.sim_uuid,si.sim_type,null
 ) ob on true
 where si.imsi like '60301%' or si.sim_type='mobilis-sama'
 order by si.last_seen_at desc
 limit 25;
end;
$fn$;
revoke all on function public.flexy_mini_admin_sama_readiness() from public,anon;
grant execute on function public.flexy_mini_admin_sama_readiness() to authenticated;
