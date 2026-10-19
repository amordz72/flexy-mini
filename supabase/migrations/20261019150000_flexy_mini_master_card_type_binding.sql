-- Master Card owns the commercial card types and stock.
-- Flexy Mini products are presentation/pricing bindings, never a second card-type registry.
-- Existing unmapped products remain for historical/admin review, but customer catalog cannot expose them.
alter table public.flexy_mini_products
  add column if not exists master_type_key text
  references public.card_stock_types(type_key) on update cascade on delete restrict;

create unique index if not exists flexy_mini_products_master_type_key_uniq
  on public.flexy_mini_products(master_type_key) where master_type_key is not null;

-- Preserve product IDs, variants, prices and customer grants. Align by verified identity.
update public.flexy_mini_products set master_type_key='mobilis'
 where name='Mobilis' and master_type_key is null;
update public.flexy_mini_products set master_type_key='idoom'
 where name='IDOOM ADSL' and master_type_key is null;
update public.flexy_mini_products set master_type_key='pubg'
 where name='PUBG Mobile' and master_type_key is null;
update public.flexy_mini_products set master_type_key='free_fire'
 where name='Free Fire' and master_type_key is null;

-- Existing Djezzy, Ooredoo, LTE have no matching Master type; retain records
-- without making them eligible for customer sale.
update public.flexy_mini_products set display_mode='hidden'
 where master_type_key is null and display_mode<>'hidden';

create or replace function private.flexy_mini_require_master_card_type()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
  if new.master_type_key is null or btrim(new.master_type_key)='' then
    raise exception 'MASTER_CARD_TYPE_REQUIRED' using errcode='23514';
  end if;
  select t.name into v_name
    from public.card_stock_types t
   where t.type_key=new.master_type_key and t.active=true;
  if not found then
    raise exception 'MASTER_CARD_TYPE_NOT_ACTIVE' using errcode='23514';
  end if;
  if tg_op='INSERT' or new.master_type_key is distinct from old.master_type_key then
    -- New product names are issued by Master Card, not typed independently in Flexy Mini.
    new.name:=v_name;
  end if;
  return new;
end;
$$;

drop trigger if exists flexy_mini_product_master_type_guard on public.flexy_mini_products;
create trigger flexy_mini_product_master_type_guard
before insert or update of master_type_key on public.flexy_mini_products
for each row execute function private.flexy_mini_require_master_card_type();

-- Counts come from actual available Master cards, never flexy_mini_variants.stock_quantity.
-- Accessible to the server-side customer service only; no code or secret fields are returned.
create or replace function public.flexy_mini_master_stock_summary()
returns table(type_key text, denomination text, available_count bigint)
language sql stable security invoker set search_path='' as $$
  select i.type_key, i.denomination, count(*)::bigint
    from public.card_stock_items i
    join public.card_stock_types t on t.type_key=i.type_key and t.active=true
   where i.status='available'
   group by i.type_key,i.denomination
$$;
revoke all on function public.flexy_mini_master_stock_summary()
  from public,anon,authenticated;
grant execute on function public.flexy_mini_master_stock_summary() to service_role;
comment on function public.flexy_mini_master_stock_summary() is
 'Service-only read of live Master Card availability by exact type and denomination; never an independent Flexy stock.';


-- Newly added denominations must already exist in Master Card's actual stock history.
-- Existing legacy Flexy pricing rows are preserved; no automatic deletion or sale is performed.
create or replace function private.flexy_mini_require_master_sku()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_type text;
begin
  select p.master_type_key into v_type
  from public.flexy_mini_products p
  join public.card_stock_types t on t.type_key=p.master_type_key and t.active=true
  where p.id=new.product_id;
  if v_type is null then
    raise exception 'MASTER_CARD_TYPE_REQUIRED' using errcode='23514';
  end if;
  if new.denomination is null or not exists(
    select 1 from public.card_stock_items i
    where i.type_key=v_type and i.denomination=new.denomination::text
  ) then
    raise exception 'MASTER_CARD_SKU_REQUIRED' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists flexy_mini_variant_master_sku_guard on public.flexy_mini_variants;
create trigger flexy_mini_variant_master_sku_guard
before insert or update of product_id, denomination on public.flexy_mini_variants
for each row execute function private.flexy_mini_require_master_sku();
