-- Phase 2: read-only, paged detail of the SAME Flexy orders as the summary report.
-- No join to sales, Station jobs or wallet; no phone numbers, raw USSD, PINs or customer PII.
create function public.flexy_mini_admin_financial_report_orders(
  p_from date,
  p_to date,
  p_operator text default 'all',
  p_status text default 'all',
  p_limit integer default 10,
  p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_total bigint;
  v_rows jsonb;
begin
  if auth.uid() is null or not private.is_shop_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 1095 then
    raise exception 'Invalid date range' using errcode='22023';
  end if;
  if coalesce(p_operator,'') not in ('all','mobilis','djezzy','ooredoo') or
     coalesce(p_status,'') not in ('all','success','failed','review','queued','claimed','unavailable') then
    raise exception 'Invalid report filter' using errcode='22023';
  end if;
  if p_limit is null or p_limit not between 1 and 50
     or p_offset is null or p_offset < 0 or p_offset > 100000 then
    raise exception 'Invalid pagination' using errcode='22023';
  end if;
  v_start := p_from::timestamp at time zone 'Africa/Algiers';
  v_end := (p_to + 1)::timestamp at time zone 'Africa/Algiers';

  select count(*) into v_total
  from public.flexy_orders o
  where o.created_at >= v_start and o.created_at < v_end
    and (p_operator='all' or o.operator=p_operator)
    and (p_status='all' or o.status=p_status);

  select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at desc,item.id desc),'[]'::jsonb)
  into v_rows
  from (
    select o.id,o.created_at,o.operator,o.service_type,o.status,
      o.face_amount,
      -- A success state is not verified settlement. These are stored financial snapshots only.
      case when o.status='success' then o.sale_price else null end as recorded_sale_price,
      case when o.status='success' then o.profit_amount else null end as recorded_profit,
      case when o.status='success' then o.rate_percent_applied else null end as applied_rate,
      o.result_code,
      (o.status='success' and (
        coalesce(o.result_code,'') ilike '%ASSUMED%' or
        coalesce(o.result_code,'') ilike '%INFERRED%')) as inferred_success
    from public.flexy_orders o
    where o.created_at >= v_start and o.created_at < v_end
      and (p_operator='all' or o.operator=p_operator)
      and (p_status='all' or o.status=p_status)
    order by o.created_at desc,o.id desc
    limit p_limit offset p_offset
  ) item;

  return jsonb_build_object('read_only',true,'source','public.flexy_orders',
    'from',p_from,'to',p_to,'total',v_total,
    'limit',p_limit,'offset',p_offset,
    'rows',v_rows,
    'warning_ar','النجاح المسجل ليس تأكيد تحصيل؛ القيم الناقصة تبقى غير معروفة');
end
$$;
revoke all on function public.flexy_mini_admin_financial_report_orders(date,date,text,text,integer,integer) from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_financial_report_orders(date,date,text,text,integer,integer) to authenticated;
comment on function public.flexy_mini_admin_financial_report_orders(date,date,text,text,integer,integer) is
 'Admin-only paginated immutable historical Flexy order snapshot listing; read-only with no PII and no financial posting.';
