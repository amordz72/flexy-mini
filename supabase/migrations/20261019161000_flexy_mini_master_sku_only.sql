-- Master has the SKU history too: a denomination may be present but currently sold out.
-- This catalog function lists real Master type/denomination pairs, with only AVAILABLE quantity.
-- No voucher secrets or purchase source information are exposed.
create or replace function public.flexy_mini_master_stock_summary()
returns table(type_key text, denomination text, available_count bigint)
language sql stable security invoker set search_path='' as $$
  select i.type_key,i.denomination,
         count(*) filter (where i.status='available')::bigint as available_count
    from public.card_stock_items i
    join public.card_stock_types t on t.type_key=i.type_key and t.active=true
   where i.status in ('available','reserved','used','review')
   group by i.type_key,i.denomination
$$;
revoke all on function public.flexy_mini_master_stock_summary()
 from public,anon,authenticated;
grant execute on function public.flexy_mini_master_stock_summary() to service_role;
comment on function public.flexy_mini_master_stock_summary() is
 'Only Master stock-known card type/denomination pairs, with live available count (may be zero); never local Flexy quantities.';
