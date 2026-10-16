-- Admin-only, read-only quote for existing catalog card/game/IDOOM variants.
-- Does NOT create orders, move wallets, reserve cards, select SIMs or execute USSD.
-- Customer-specific discount is required. Never fall back to mutable defaults.
create function public.flexy_mini_admin_card_price_preview(
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
         p.active as product_active,p.is_frozen as product_frozen
    into v_variant
    from public.flexy_mini_variants v
    join public.flexy_mini_products p on p.id=v.product_id
    where v.id=p_variant_id;
  if not found then
    raise exception 'Variant not found' using errcode='22023';
  end if;
  select discount_percent into v_rate
    from public.flexy_mini_discount_rates
    where customer_id=p_customer_id and service_key='card:' || v_variant.product_id::text;

  v_status := case
    when not v_customer.active then 'inactive_customer'
    when not v_variant.product_active or v_variant.product_frozen or not v_variant.active or v_variant.is_frozen then 'inactive_or_frozen'
    when v_rate is null then 'rate_unset'
    when v_variant.sale_price is null or v_variant.sale_price <= 0 then 'sale_price_unset'
    when v_variant.purchase_price is null or v_variant.purchase_price <= 0 then 'purchase_price_unset'
    when coalesce(v_variant.stock_quantity,0) < 1 then 'out_of_stock'
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
    'stock_quantity',v_variant.stock_quantity,
    'customer_charge',v_charge,'margin_before_other_fees',v_gross,
    'in_stock',coalesce(v_variant.stock_quantity,0)>0,
    'can_sell',false,
    'notice_ar','معاينة إدارية فقط؛ الربح قبل المصاريف الأخرى، ولا توجد عملية دفع أو شحن'
  );
end
$$;
revoke all on function public.flexy_mini_admin_card_price_preview(bigint,bigint) from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_card_price_preview(bigint,bigint) to authenticated;
comment on function public.flexy_mini_admin_card_price_preview(bigint,bigint) is
 'Admin-only read-only price preview using saved customer rate and existing variant retail/purchase cost; no wallet or dispatch and no default fallback.';
