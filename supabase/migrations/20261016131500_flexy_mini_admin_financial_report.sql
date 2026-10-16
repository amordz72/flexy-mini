-- Flexy Mini financial reports phase 1: strictly read-only from existing flexy_orders.
-- NEVER union with shared MyTool sales, card inventory, wallet ledger or station jobs.
-- "success" is the stored technical state, not proof of a settled customer sale.
create function public.flexy_mini_admin_financial_report(
  p_from date,
  p_to date,
  p_operator text default 'all',
  p_status text default 'all'
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_summary jsonb;
  v_groups jsonb;
begin
  if auth.uid() is null or not private.is_shop_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 1095 then
    raise exception 'Invalid date range (maximum 1096 days inclusive)' using errcode='22023';
  end if;
  if coalesce(p_operator,'') not in ('all','mobilis','djezzy','ooredoo') or
     coalesce(p_status,'') not in ('all','success','failed','review','queued','claimed','unavailable') then
    raise exception 'Invalid report filter' using errcode='22023';
  end if;

  -- User-selected dates are Algeria-local days, inclusive on BOTH ends.
  v_start := p_from::timestamp at time zone 'Africa/Algiers';
  v_end := (p_to + 1)::timestamp at time zone 'Africa/Algiers';

  with selected as (
    select o.operator,o.service_type,o.status,o.face_amount,o.sale_price,o.profit_amount,o.result_code
    from public.flexy_orders o
    where o.created_at >= v_start and o.created_at < v_end
      and (p_operator='all' or o.operator=p_operator)
      and (p_status='all' or o.status=p_status)
  )
  select jsonb_build_object(
    'total_orders',count(*),
    'success_status_count',count(*) filter (where status='success'),
    'failed_count',count(*) filter (where status='failed'),
    'other_status_count',count(*) filter (where status not in ('success','failed')),
    'inferred_success_count',count(*) filter (where status='success' and
      (coalesce(result_code,'') ilike '%ASSUMED%' or coalesce(result_code,'') ilike '%INFERRED%')),
    'success_nominal_amount',coalesce(sum(face_amount) filter (where status='success'),0),
    'all_status_nominal_amount',coalesce(sum(face_amount),0),
    'success_with_revenue_count',count(sale_price) filter (where status='success'),
    'success_with_profit_count',count(profit_amount) filter (where status='success'),
    'recorded_revenue',case when count(*) filter (where status='success') > 0
      and count(*) filter (where status='success' and sale_price is null)=0
      then sum(sale_price) filter (where status='success') else null end,
    'recorded_direct_profit',case when count(*) filter (where status='success') > 0
      and count(*) filter (where status='success' and profit_amount is null)=0
      then sum(profit_amount) filter (where status='success') else null end,
    'expenses',null,'net_profit',null
  ) into v_summary from selected;

  with selected as (
    select o.operator,o.service_type,o.status,o.face_amount,o.sale_price,o.profit_amount,o.result_code
    from public.flexy_orders o
    where o.created_at >= v_start and o.created_at < v_end
      and (p_operator='all' or o.operator=p_operator)
      and (p_status='all' or o.status=p_status)
  ), grouped as (
    select operator, service_type,
      count(*) total_orders,
      count(*) filter (where status='success') success_status_count,
      count(*) filter (where status='failed') failed_count,
      count(*) filter (where status not in ('success','failed')) other_status_count,
      count(*) filter (where status='success' and
        (coalesce(result_code,'') ilike '%ASSUMED%' or coalesce(result_code,'') ilike '%INFERRED%')) inferred_success_count,
      coalesce(sum(face_amount) filter (where status='success'),0) success_nominal_amount,
      count(profit_amount) filter (where status='success') success_with_profit_count,
      case when count(*) filter (where status='success') > 0
        and count(*) filter (where status='success' and sale_price is null)=0
        then sum(sale_price) filter (where status='success') else null end recorded_revenue,
      case when count(*) filter (where status='success') > 0
        and count(*) filter (where status='success' and profit_amount is null)=0
        then sum(profit_amount) filter (where status='success') else null end recorded_direct_profit
    from selected
    group by operator,service_type
  )
  select coalesce(jsonb_agg(to_jsonb(grouped) order by operator,service_type),'[]'::jsonb)
    into v_groups from grouped;

  return jsonb_build_object(
    'source','public.flexy_orders',
    'read_only',true,
    'from',p_from,'to',p_to,'date_timezone','Africa/Algiers',
    'operator_filter',p_operator,'status_filter',p_status,
    'summary',v_summary,'groups',v_groups,
    'coverage',jsonb_build_object(
      'flexy_orders',true,'cards_and_games',false,'idoom',false,
      'shared_sales',false,'station_jobs',false,'wallet_movements',false,
      'expenses_registered',false,'net_profit_available',false),
    'warning_ar','الحالات المسجلة نجاحًا قد تكون مستنتجة تقنيًا. المبلغ الاسمي ليس مبيعات محصلة. الأرباح والمصاريف غير المكتملة لا تُعامل كصفر.'
  );
end
$$;
revoke all on function public.flexy_mini_admin_financial_report(date,date,text,text) from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_financial_report(date,date,text,text) to authenticated;
comment on function public.flexy_mini_admin_financial_report(date,date,text,text) is
 'Read-only admin report from flexy_orders, date range Algeria local. Does not infer income from nominal value or missing profit; excludes wallet, sales and station jobs.';
