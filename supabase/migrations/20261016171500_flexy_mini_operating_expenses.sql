-- A platform-specific expense register, distinct from shared MyTool branch/money_operations.
-- No backfill and NO inference from example screenshots. Expense rows do not move cash.
create table public.flexy_mini_operating_expenses (
  id bigint generated always as identity primary key,
  request_key uuid not null unique,
  expense_date date not null,
  category text not null check(category in ('hosting','internet','subscription','equipment','fees','other')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  amount numeric(14,2) not null check (amount > 0 and amount <= 100000000),
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  constraint flexy_mini_expense_void_pair check (
    (voided_at is null and voided_by is null and void_reason is null) or
    (voided_at is not null and voided_by is not null and char_length(btrim(void_reason)) between 4 and 300)
  )
);
create index flexy_mini_expenses_date_id on public.flexy_mini_operating_expenses(expense_date desc,id desc);
alter table public.flexy_mini_operating_expenses enable row level security;
revoke all on public.flexy_mini_operating_expenses from PUBLIC,anon,authenticated;
revoke all on sequence public.flexy_mini_operating_expenses_id_seq from PUBLIC,anon,authenticated;
comment on table public.flexy_mini_operating_expenses is
'Flexy Mini only: manually entered platform operating expenses. No connection to MyTool cash/branch ledgers. Soft void leaves audit trail; never creates money movements.';

create function public.flexy_mini_admin_expenses_list(
 p_from date,p_to date,p_limit integer default 10,p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_total bigint; v_active bigint; v_amount numeric; v_rows jsonb;
begin
 if auth.uid() is null or not private.is_shop_admin() then
   raise exception 'Admin only' using errcode='42501';
 end if;
 if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 1095 then
   raise exception 'Invalid date range' using errcode='22023';
 end if;
 if p_limit is null or p_limit not between 1 and 50 or
    p_offset is null or p_offset < 0 or p_offset > 100000 then
   raise exception 'Invalid pagination' using errcode='22023';
 end if;
 select count(*),count(*) filter(where voided_at is null),
   coalesce(sum(amount) filter(where voided_at is null),0)
 into v_total,v_active,v_amount
 from public.flexy_mini_operating_expenses
 where expense_date between p_from and p_to;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.expense_date desc,e.id desc),'[]'::jsonb)
 into v_rows from (
   select id,expense_date,category,title,amount,note,created_at,voided_at,void_reason
   from public.flexy_mini_operating_expenses
   where expense_date between p_from and p_to
   order by expense_date desc,id desc
   limit p_limit offset p_offset
 ) e;
 return jsonb_build_object('source','public.flexy_mini_operating_expenses',
   'from',p_from,'to',p_to,'total_rows',v_total,
   'active_rows',v_active,'active_total',v_amount,
   'limit',p_limit,'offset',p_offset,'rows',v_rows);
end
$$;
revoke all on function public.flexy_mini_admin_expenses_list(date,date,integer,integer) from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_expenses_list(date,date,integer,integer) to authenticated;

create function public.flexy_mini_admin_expense_create(
 p_request_key uuid,p_expense_date date,p_category text,p_title text,
 p_amount numeric,p_note text default ''
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_id bigint; v_existing public.flexy_mini_operating_expenses%rowtype;
begin
 if auth.uid() is null or not private.is_shop_admin() then
   raise exception 'Admin only' using errcode='42501';
 end if;
 if p_request_key is null or p_expense_date is null or
   p_category is null or p_category not in ('hosting','internet','subscription','equipment','fees','other') or
   p_title is null or char_length(btrim(p_title)) not between 1 and 120 or
   p_amount is null or p_amount <= 0 or p_amount > 100000000 or
   p_amount <> round(p_amount,2) or
   char_length(coalesce(p_note,'')) > 500 then
   raise exception 'Invalid expense fields' using errcode='22023';
 end if;
 insert into public.flexy_mini_operating_expenses
   (request_key,expense_date,category,title,amount,note,created_by)
 values(p_request_key,p_expense_date,p_category,btrim(p_title),p_amount,btrim(coalesce(p_note,'')),auth.uid())
 on conflict (request_key) do nothing
 returning id into v_id;
 if v_id is not null then return v_id; end if;
 select * into v_existing from public.flexy_mini_operating_expenses where request_key=p_request_key;
 if v_existing.id is null or v_existing.created_by is distinct from auth.uid() or
   v_existing.expense_date is distinct from p_expense_date or
   v_existing.category is distinct from p_category or
   v_existing.title is distinct from btrim(p_title) or
   v_existing.amount is distinct from p_amount or
   v_existing.note is distinct from btrim(coalesce(p_note,'')) then
   raise exception 'Request key already used for a different expense' using errcode='23505';
 end if;
 return v_existing.id;
end
$$;
revoke all on function public.flexy_mini_admin_expense_create(uuid,date,text,text,numeric,text) from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_expense_create(uuid,date,text,text,numeric,text) to authenticated;

create function public.flexy_mini_admin_expense_void(p_expense_id bigint,p_reason text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_id bigint; v_existing bigint;
begin
 if auth.uid() is null or not private.is_shop_admin() then
   raise exception 'Admin only' using errcode='42501';
 end if;
 if p_expense_id is null or p_expense_id < 1 or p_reason is null or
    char_length(btrim(p_reason)) not between 4 and 300 then
   raise exception 'Expense ID and reason required' using errcode='22023';
 end if;
 update public.flexy_mini_operating_expenses
 set voided_at=now(),voided_by=auth.uid(),void_reason=btrim(p_reason)
 where id=p_expense_id and voided_at is null
 returning id into v_id;
 if v_id is not null then return true; end if;
 select id into v_existing from public.flexy_mini_operating_expenses
 where id=p_expense_id and voided_at is not null;
 if v_existing is not null then return false; end if;
 raise exception 'Expense not found' using errcode='22023';
end
$$;
revoke all on function public.flexy_mini_admin_expense_void(bigint,text) from PUBLIC,anon;
grant execute on function public.flexy_mini_admin_expense_void(bigint,text) to authenticated;
