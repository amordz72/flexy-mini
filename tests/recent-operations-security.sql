begin;
do $test$
begin
 begin
  perform public.flexy_mini_admin_recent_operations(10,0);
  raise exception 'ADMIN_GUARD_MISSING';
 exception when insufficient_privilege then null;
 end;
 if has_function_privilege('anon','public.flexy_mini_admin_recent_operations(integer,integer)','EXECUTE')
   or not has_function_privilege('authenticated','public.flexy_mini_admin_recent_operations(integer,integer)','EXECUTE') then
  raise exception 'HISTORY_GRANTS_INCORRECT';
 end if;
end;
$test$;
select 'PASS: administrator guard and grants' as regression_result;
rollback;
begin;
do $test$
declare v_admin uuid; v_count integer;
begin
 select a.user_id into v_admin from private.shop_admins a limit 1;
 if v_admin is null then raise exception 'NO_ADMIN_TEST_CONTEXT'; end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 select count(*) into v_count from public.flexy_mini_admin_recent_operations(10,0);
 if v_count>10 then raise exception 'HISTORY_LIMIT_NOT_ENFORCED'; end if;
 if not exists(select 1 from public.flexy_mini_admin_recent_operations(50,0) r
   where r.result_code='DISCOVERY_TERMINAL' and r.result_text='Please Enter your PIN code'
     and jsonb_typeof(r.responses)='array') then raise exception 'RAW_PIN_PROMPT_NOT_VISIBLE'; end if;
 begin
  perform public.flexy_mini_admin_recent_operations(100,0);
  raise exception 'INVALID_LIMIT_ACCEPTED';
 exception when invalid_parameter_value then null;
 end;
end;
$test$;
select 'PASS: typed history result, bounded paging, actual PIN prompt raw response and invalid paging rejection' as regression_result;
rollback;
