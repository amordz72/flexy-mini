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

-- Keep read-only admin preview consistent with Master Card; sale remains disabled.
-- Admin-only, read-only quote for existing catalog card/game/IDOOM variants.
-- Does NOT create orders, move wallets, reserve cards, select SIMs or execute USSD.
-- Customer-specific discount is required. Never fall back to mutable defaults.
create or replace function public.flexy_mini_admin_card_price_preview(
  p_customer_id bigint,
  p_variant_id bigint
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer record;
  v_variant record;
  v_rate numeric;
  v_charge numeric;
  v_gross numeric;
  v_status text;
  v_master_type_key text;
  v_master_active boolean;
  v_master_count bigint := 0;
begin
  if auth.uid() is null or not private.is_shop_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;
  if p_customer_id is null or p_customer_id <= 0 or
     p_variant_id is null or p_variant_id <= 0 then
    raise exception 'Customer and variant required' using errcode='22023';
  end if;
  select id,username,active into v_customer
    from public.flexy_mini_customer_accounts where id=p_customer_id;
  if not found then
    raise exception 'Customer not found' using errcode='22023';
  end if;
  select v.id,v.name,v.denomination,v.purchase_price,v.sale_price,v.stock_quantity,
         v.active,v.is_frozen,p.id as product_id,p.name as product_name,
         p.active as product_active,p.is_frozen as product_frozen,p.master_type_key
    into v_variant
    from public.flexy_mini_variants v
    join public.flexy_mini_products p on p.id=v.product_id
    where v.id=p_variant_id;
  if not found then
    raise exception 'Variant not found' using errcode='22023';
  end if;
  v_master_type_key := v_variant.master_type_key;
  select exists(select 1 from public.card_stock_types t where t.type_key=v_master_type_key and t.active) into v_master_active;
  if v_master_active then
    select count(*)::bigint into v_master_count from public.card_stock_items i
    where i.type_key=v_master_type_key and i.denomination=v_variant.denomination::text and i.status='available';
  end if;
  select discount_percent into v_rate
    from public.flexy_mini_discount_rates
    where customer_id=p_customer_id and service_key='card:' || v_variant.product_id::text;

  v_status := case
    when not v_customer.active then 'inactive_customer'
    when not v_variant.product_active or v_variant.product_frozen or not v_variant.active or v_variant.is_frozen then 'inactive_or_frozen'
    when not v_master_active then 'master_type_unavailable'
    when v_rate is null then 'rate_unset'
    when v_variant.sale_price is null or v_variant.sale_price <= 0 then 'sale_price_unset'
    when v_variant.purchase_price is null or v_variant.purchase_price <= 0 then 'purchase_price_unset'
    when v_master_count < 1 then 'out_of_stock'
    else 'preview_only'
  end;

  -- A rate and two actual, positive prices are required before displaying ANY monetary profit.
  if v_rate is not null and v_variant.sale_price > 0 and v_variant.purchase_price > 0
     and v_customer.active and v_variant.product_active and not v_variant.product_frozen
     and v_variant.active and not v_variant.is_frozen then
    v_charge := round(v_variant.sale_price * (1 - v_rate / 100), 2);
    v_gross := round(v_charge - v_variant.purchase_price, 2);
  end if;
  return jsonb_build_object(
    'status',v_status,'quote_only',true,'financial_dispatch_enabled',false,
    'customer_id',p_customer_id,'username',v_customer.username,
    'variant_id',p_variant_id,'variant_name',v_variant.name,
    'product_id',v_variant.product_id,'product_name',v_variant.product_name,
    'discount_percent',v_rate,'retail_price',v_variant.sale_price,
    'purchase_price',v_variant.purchase_price,
    'stock_quantity',v_master_count,
    'customer_charge',v_charge,'margin_before_other_fees',v_gross,
    'in_stock',v_master_count>0,
    'can_sell',false,
    'notice_ar','معاينة إدارية فقط؛ الربح قبل المصاريف الأخرى، ولا توجد عملية دفع أو شحن'
  );
end
$$;
revoke all on function public.flexy_mini_admin_card_price_preview(bigint,bigint) from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_card_price_preview(bigint,bigint) to authenticated;
comment on function public.flexy_mini_admin_card_price_preview(bigint,bigint) is
 'Admin-only read-only price preview using saved customer rate and existing variant retail/purchase cost; no wallet or dispatch and no default fallback.';
