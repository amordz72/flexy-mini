-- Flexy Mini only: confirmed presentation (View Index) order.
-- Reuses canonical flexy_offer_catalog.sort_index; never touches execution routes,
-- network_index, pricing, grant rules, wallets, stations or financial jobs.
create or replace function public.flexy_mini_admin_offer_view_reorder(
  p_offer_uuid uuid,
  p_target_position integer,
  p_expected_updated_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.flexy_offer_catalog%rowtype;
  v_ids uuid[];
  v_without uuid[];
  v_new uuid[] := '{}'::uuid[];
  v_total integer;
  v_old integer;
  v_i integer;
  v_cursor integer := 1;
  v_changed integer;
begin
  if auth.uid() is null or not private.is_shop_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_offer_uuid is null or p_target_position is null or
     p_target_position < 1 or p_target_position > 500 or
     p_expected_updated_at is null then
    raise exception 'INVALID_VIEW_POSITION' using errcode='22023';
  end if;

  select * into v_offer
    from public.flexy_offer_catalog where offer_uuid=p_offer_uuid;
  if not found then
    raise exception 'OFFER_NOT_FOUND' using errcode='22023';
  end if;

  -- Serialize reorders of one operator+family; ordinary-credit and USSD routes
  -- do not share this lock or have their own state changed by this RPC.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('flexy-view-index:'||v_offer.operator||':'||v_offer.family,0)
  );

  select * into v_offer
    from public.flexy_offer_catalog where offer_uuid=p_offer_uuid for update;
  if not found or v_offer.updated_at is distinct from p_expected_updated_at then
    raise exception 'VIEW_ORDER_STALE_RELOAD' using errcode='40001';
  end if;

  -- Lock stable existing rows before assigning a contiguous position.
  perform 1 from public.flexy_offer_catalog
    where operator=v_offer.operator and family=v_offer.family
    order by sort_index,amount,offer_uuid
    for update;

  select pg_catalog.array_agg(offer_uuid order by sort_index,amount,offer_uuid)
    into v_ids
    from public.flexy_offer_catalog
    where operator=v_offer.operator and family=v_offer.family;
  v_total := pg_catalog.coalesce(pg_catalog.array_length(v_ids,1),0);
  if p_target_position > v_total or v_total=0 then
    raise exception 'VIEW_POSITION_OUT_OF_RANGE' using errcode='22023';
  end if;

  v_old := pg_catalog.array_position(v_ids,p_offer_uuid);
  v_without := pg_catalog.array_remove(v_ids,p_offer_uuid);
  for v_i in 1..v_total loop
    if v_i=p_target_position then
      v_new := pg_catalog.array_append(v_new,p_offer_uuid);
    else
      v_new := pg_catalog.array_append(v_new,v_without[v_cursor]);
      v_cursor := v_cursor+1;
    end if;
  end loop;

  -- Never update the offer's commercial identity or anything execution-related.
  update public.flexy_offer_catalog as c
    set sort_index = ranked.position::integer,
        updated_at = now()
    from pg_catalog.unnest(v_new) with ordinality as ranked(id,position)
    where c.offer_uuid = ranked.id
      and c.sort_index is distinct from ranked.position::integer;
  get diagnostics v_changed = row_count;

  return pg_catalog.jsonb_build_object(
    'offer_uuid',p_offer_uuid,
    'operator',v_offer.operator,
    'family',v_offer.family,
    'previous_position',v_old,
    'new_position',p_target_position,
    'family_count',v_total,
    'changed_rows',v_changed
  );
end;
$$;

revoke all on function public.flexy_mini_admin_offer_view_reorder(uuid,integer,timestamptz) from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_offer_view_reorder(uuid,integer,timestamptz) to authenticated;
comment on function public.flexy_mini_admin_offer_view_reorder(uuid,integer,timestamptz)
is 'Admin only: reorder offer appearance within its operator/family. Does not modify execution index, route, network commands or financial records.';
