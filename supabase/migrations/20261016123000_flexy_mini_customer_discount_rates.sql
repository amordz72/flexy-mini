-- Flexy Mini customer discounts: one rate registry, scoped to default template or one existing account.
-- No example rates are seeded; live customer rates are deliberately undefined until set by an admin.
-- Does NOT alter wallets, transfers, Station jobs, routing, card costs or existing Flexy account tables.
create table public.flexy_mini_discount_rates (
  id bigint generated always as identity primary key,
  customer_id bigint references public.flexy_mini_customer_accounts(id) on delete restrict,
  service_key text not null,
  discount_percent numeric(5,2) not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint flexy_mini_discount_rate_bounds check (discount_percent >= 0 and discount_percent <= 100),
  constraint flexy_mini_discount_rate_service_key check (
    service_key in ('mobilis-credit','mobilis-offer','djezzy-credit','ooredoo-credit')
    or service_key ~ '^card:[1-9][0-9]*$'
  )
);
create unique index flexy_mini_discount_default_unique on public.flexy_mini_discount_rates(service_key)
  where customer_id is null;
create unique index flexy_mini_discount_customer_unique on public.flexy_mini_discount_rates(customer_id,service_key)
  where customer_id is not null;
create index flexy_mini_discount_customer_lookup on public.flexy_mini_discount_rates(customer_id)
  where customer_id is not null;
alter table public.flexy_mini_discount_rates enable row level security;
revoke all on public.flexy_mini_discount_rates from PUBLIC,anon,authenticated;
revoke all on sequence public.flexy_mini_discount_rates_id_seq from PUBLIC,anon,authenticated;
grant select,insert,update on public.flexy_mini_discount_rates to service_role;
grant usage,select on sequence public.flexy_mini_discount_rates_id_seq to service_role;
comment on table public.flexy_mini_discount_rates is 'Single registry: null customer_id = new-account default template; non-null = immutable-on-default-change customer-specific rate. No pricing fallback through live defaults.';

-- A new account receives only the defaults that already exist at signup time. No retroactive backfill.
create function public.flexy_mini_copy_discount_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.flexy_mini_discount_rates(customer_id,service_key,discount_percent,updated_at)
    select new.id,service_key,discount_percent,now()
    from public.flexy_mini_discount_rates
    where customer_id is null
  on conflict (customer_id,service_key) where customer_id is not null do nothing;
  return new;
end
$$;
revoke all on function public.flexy_mini_copy_discount_defaults() from PUBLIC,anon,authenticated;
create trigger flexy_mini_copy_discount_defaults_after_create
  after insert on public.flexy_mini_customer_accounts
  for each row execute function public.flexy_mini_copy_discount_defaults();

-- Read via admin-authorized RPC; the raw table is not exposed to app JWT roles.
create function public.flexy_mini_admin_discount_rates_read()
returns table(customer_id bigint, service_key text, discount_percent numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_shop_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;
  return query
    select r.customer_id,r.service_key,r.discount_percent
    from public.flexy_mini_discount_rates r
    order by r.customer_id nulls first,r.service_key;
end
$$;
revoke all on function public.flexy_mini_admin_discount_rates_read() from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_discount_rates_read() to authenticated;

create function public.flexy_mini_admin_discount_rate_set(
  p_service_key text,
  p_discount_percent numeric,
  p_customer_id bigint default null
) returns numeric
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_shop_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;
  if p_service_key is null or
     not (p_service_key in ('mobilis-credit','mobilis-offer','djezzy-credit','ooredoo-credit')
       or p_service_key ~ '^card:[1-9][0-9]*$') then
    raise exception 'Unknown service key' using errcode='22023';
  end if;
  if p_discount_percent is null or p_discount_percent < 0 or p_discount_percent > 100
     or p_discount_percent <> round(p_discount_percent,2) then
    raise exception 'Invalid discount percentage' using errcode='22023';
  end if;
  if p_service_key like 'card:%' and not exists (
    select 1 from public.flexy_mini_products p
    where p.id = split_part(p_service_key,':',2)::bigint
  ) then
    raise exception 'Product not found' using errcode='22023';
  end if;
  if p_customer_id is not null and not exists(
    select 1 from public.flexy_mini_customer_accounts c where c.id=p_customer_id
  ) then
    raise exception 'Customer not found' using errcode='22023';
  end if;
  if p_customer_id is null then
    insert into public.flexy_mini_discount_rates(customer_id,service_key,discount_percent,updated_by,updated_at)
      values(null,p_service_key,p_discount_percent,auth.uid(),now())
    on conflict (service_key) where customer_id is null do update
      set discount_percent=excluded.discount_percent,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  else
    insert into public.flexy_mini_discount_rates(customer_id,service_key,discount_percent,updated_by,updated_at)
      values(p_customer_id,p_service_key,p_discount_percent,auth.uid(),now())
    on conflict (customer_id,service_key) where customer_id is not null do update
      set discount_percent=excluded.discount_percent,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end if;
  return p_discount_percent;
end
$$;
revoke all on function public.flexy_mini_admin_discount_rate_set(text,numeric,bigint) from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_discount_rate_set(text,numeric,bigint) to authenticated;
