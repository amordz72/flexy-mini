-- Run as a database administrator against an approved test environment.
-- All fixture rows are rolled back. Does not modify the shared Master directory.
begin;
do $$
declare cid bigint; master_id bigint; d1 bigint; d2 bigint; d3 bigint; result jsonb;
begin
  select id into master_id from public.money_party_directory m
  where active and is_canonical and approval_status='approved'
  and not exists(select 1 from public.flexy_mini_customer_accounts a where a.party_id=m.id) limit 1;
  if master_id is null then raise exception 'No eligible unassigned Master for regression fixture'; end if;
  insert into public.flexy_mini_customer_accounts(party_id,username,phone,password_hash)
  values(master_id,'device_regression_fixture','0500000002',public.flexy_mini_customer_hash_password('Regression-fixture-only')) returning id into cid;
  insert into public.flexy_mini_trusted_devices(customer_id,credential_hash) values(cid,repeat('a',64)) returning id into d1;
  insert into public.flexy_mini_trusted_devices(customer_id,credential_hash) values(cid,repeat('b',64)) returning id into d2;
  insert into public.flexy_mini_trusted_devices(customer_id,credential_hash) values(cid,repeat('c',64)) returning id into d3;
  result:=public.flexy_mini_device_session(cid,repeat('a',64),repeat('1',64));
  if result->>'allowed'<>'false' then raise exception 'Unapproved device got session'; end if;
  perform public.flexy_mini_manage_device(d1,true,false);
  perform public.flexy_mini_manage_device(d2,true,true);
  begin
    perform public.flexy_mini_manage_device(d3,true,false);
    raise exception 'Third approved device allowed';
  exception when others then
    if sqlerrm not like '%MAX_TWO_TRUSTED_DEVICES%' then raise; end if;
  end;
  result:=public.flexy_mini_device_session(cid,repeat('a',64),repeat('1',64));
  if result->>'allowed'<>'true' then raise exception 'Approved device denied'; end if;
  result:=public.flexy_mini_device_session(cid,repeat('a',64),repeat('2',64));
  perform public.flexy_mini_manage_device(d1,false,false);
  if exists(select 1 from public.flexy_mini_customer_sessions where device_id=d1 and revoked_at is null) then raise exception 'Revocation left live sessions'; end if;
  perform public.flexy_mini_manage_device(d3,true,false);
  update public.flexy_mini_trusted_devices set expires_at=now()-interval '1 second' where id=d3;
  result:=public.flexy_mini_device_session(cid,repeat('c',64),repeat('3',64));
  if result->>'allowed'<>'false' then raise exception 'Expired device got session'; end if;
  perform public.flexy_mini_manage_device(d1,true,false);
  if not exists(select 1 from public.flexy_mini_trusted_devices where id=d3 and revoked_at is not null) then raise exception 'Expired device still occupies slot'; end if;
end $$;
rollback;
