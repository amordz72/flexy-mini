-- Isolated Flexy Mini tables only. Existing two-device trigger remains authoritative.
alter table public.flexy_mini_trusted_devices add column if not exists last_used_at timestamptz;
alter table public.flexy_mini_trusted_devices add column if not exists device_label text not null default 'متصفح';
alter table public.flexy_mini_trusted_devices add column if not exists expires_at timestamptz;
create unique index if not exists flexy_mini_device_credential_unique on public.flexy_mini_trusted_devices(customer_id,credential_hash);

create or replace function public.flexy_mini_device_session(p_customer_id bigint,p_credential_hash text,p_token_hash text)
returns jsonb language plpgsql set search_path='' as $$
declare d public.flexy_mini_trusted_devices; begin
  select * into d from public.flexy_mini_trusted_devices where customer_id=p_customer_id and credential_hash=p_credential_hash for update;
  if d.id is null or d.approved_at is null or d.revoked_at is not null or coalesce(d.expires_at,d.approved_at+interval '7 days')<=now() then return jsonb_build_object('allowed',false); end if;
  if not exists(select 1 from public.flexy_mini_customer_accounts where id=p_customer_id and active) then return jsonb_build_object('allowed',false); end if;
  insert into public.flexy_mini_customer_sessions(customer_id,device_id,token_hash,expires_at) values(p_customer_id,d.id,p_token_hash,least(now()+interval '12 hours',coalesce(d.expires_at,d.approved_at+interval '7 days')));
  update public.flexy_mini_trusted_devices set last_used_at=now() where id=d.id;
  return jsonb_build_object('allowed',true);
end $$;
revoke all on function public.flexy_mini_device_session(bigint,text,text) from public,anon,authenticated;
grant execute on function public.flexy_mini_device_session(bigint,text,text) to service_role;

create or replace function public.flexy_mini_device_revoke_sessions() returns trigger language plpgsql set search_path='' as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    update public.flexy_mini_customer_sessions set revoked_at=now() where device_id=new.id and revoked_at is null;
  end if;
  return new;
end $$;
drop trigger if exists flexy_mini_revoke_device_sessions on public.flexy_mini_trusted_devices;
create trigger flexy_mini_revoke_device_sessions after update on public.flexy_mini_trusted_devices for each row execute function public.flexy_mini_device_revoke_sessions();

-- Persisted account-level password attempt window; does not rely on IP.
alter table public.flexy_mini_customer_accounts add column if not exists login_attempts integer not null default 0;
alter table public.flexy_mini_customer_accounts add column if not exists login_window_at timestamptz;
create or replace function public.flexy_mini_customer_check_login(p_account_id bigint,p_password text)
returns boolean language plpgsql set search_path='' as $$
declare a public.flexy_mini_customer_accounts; begin
  select * into a from public.flexy_mini_customer_accounts where id=p_account_id for update;
  if a.id is null or not a.active then return false; end if;
  if a.login_window_at is null or a.login_window_at<now()-interval '15 minutes' then
    update public.flexy_mini_customer_accounts set login_attempts=1,login_window_at=now() where id=a.id;
  elsif a.login_attempts>=12 then return false;
  else update public.flexy_mini_customer_accounts set login_attempts=login_attempts+1 where id=a.id; end if;
  return public.flexy_mini_customer_verify_password(p_account_id,p_password);
end $$;
revoke all on function public.flexy_mini_customer_check_login(bigint,text) from public,anon,authenticated;
grant execute on function public.flexy_mini_customer_check_login(bigint,text) to service_role;

create or replace function public.flexy_mini_manage_device(p_device_id bigint,p_approve boolean,p_mobile boolean default false)
returns boolean language plpgsql set search_path='' as $$
declare cid bigint; begin
select customer_id into cid from public.flexy_mini_trusted_devices where id=p_device_id;
if cid is null then return false; end if;
perform pg_advisory_xact_lock(734021,cid::integer);
if p_approve then
update public.flexy_mini_trusted_devices set revoked_at=now() where customer_id=cid and revoked_at is null and approved_at is not null and coalesce(expires_at,approved_at+interval '7 days')<=now();
update public.flexy_mini_trusted_devices set approved_at=now(),revoked_at=null,expires_at=now()+case when p_mobile then interval '30 days' else interval '7 days' end where id=p_device_id;
else update public.flexy_mini_trusted_devices set revoked_at=now() where id=p_device_id; end if;
return true;
end $$;
revoke all on function public.flexy_mini_manage_device(bigint,boolean,boolean) from public,anon,authenticated;
grant execute on function public.flexy_mini_manage_device(bigint,boolean,boolean) to service_role;
drop index if exists public.flexy_mini_device_credential_unique;