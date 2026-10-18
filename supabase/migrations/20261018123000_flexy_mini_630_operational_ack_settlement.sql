-- Flexy Mini server-owned ordinary Mobilis Arsselli 630 operational settlement.
-- Does not modify Station Connect Agent, the gateway, the stored network balance
-- or a historical job. Executed ONLY as part of a new job's CLAIMED -> REVIEW
-- finalization; the canonical cumulative ledger then accounts SUCCESS once.
-- The accepted carrier reply is operational acceptance, not final SMS proof.

create or replace function private.flexy_mini_630_operational_ack_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.station_connect_sessions%rowtype;
  v_start public.station_connect_commands%rowtype;
  v_reply public.station_connect_commands%rowtype;
  v_release public.station_connect_commands%rowtype;
  v_count integer;
  v_session_count integer;
  v_numbers text[];
  v_prompt text;
  v_carrier_reply text;
  v_accepted boolean;
  v_rejected boolean;
begin
  -- No retroactive updates, no changes to other routes or to a settled job.
  if tg_op <> 'UPDATE'
     or old.status <> 'claimed'
     or new.status <> 'review'
     or new.result_code <> '630_CONFIRMATION_SUBMITTED_RESULT_UNKNOWN'
     or new.operation_key <> 'mobilis.flexy.ordinary.630'
     or new.source_app <> 'flexy-mini'
     or new.operation_type <> 'workflow'
     or new.target_sim_type <> 'mobilis-arsselli'
     or new.payload->>'dispatch_mode' <> 'direct_630'
     or new.payload->>'account_selection' <> 'server_priority_then_spendable'
     or new.payload->>'distributor_account_code' not in ('01','02','03','04','05')
     or new.station_uuid is null or new.modem_uuid is null or new.sim_uuid is null
     or new.phone !~ '^0[5-7][0-9]{8}$'
     or new.amount not between 40 and 50000 then
    return new;
  end if;

  select count(*) into v_session_count
  from public.station_connect_sessions s
  where s.job_uuid = new.job_uuid;
  if v_session_count <> 1 then return new; end if;

  select s.* into v_session
  from public.station_connect_sessions s
  where s.job_uuid = new.job_uuid;
  if v_session.status <> 'closed'
     or v_session.job_uuid <> new.job_uuid
     or v_session.station_uuid is distinct from new.station_uuid
     or v_session.modem_uuid is distinct from new.modem_uuid
     or v_session.sim_uuid is distinct from new.sim_uuid
     or v_session.state->>'phase' <> 'confirmation_queued'
     or v_session.state->>'financial_flow' <> 'mobilis.ordinary.630'
     or v_session.state->>'confirmation_option' <> '1'
     or v_session.state->'automatic_retry_allowed' is distinct from 'false'::jsonb
     or v_session.state->'pending_result'->>'code' <> '630_CONFIRMATION_SUBMITTED_RESULT_UNKNOWN'
  then return new; end if;

  select count(*) into v_count
  from public.station_connect_commands c
  where c.job_uuid = new.job_uuid;
  if v_count <> 3 then return new; end if;

  select c.* into v_start
  from public.station_connect_commands c
  where c.job_uuid = new.job_uuid
    and c.session_uuid = v_session.session_uuid and c.sequence = 1
    and c.action = 'ussd_start' and c.status = 'success'
    and c.completed_at is not null;
  if not found then return new; end if;

  select c.* into v_reply
  from public.station_connect_commands c
  where c.job_uuid = new.job_uuid
    and c.session_uuid = v_session.session_uuid and c.sequence = 2
    and c.action = 'ussd_reply' and c.status = 'success'
    and c.value = '1' and c.completed_at is not null;
  if not found then return new; end if;

  select c.* into v_release
  from public.station_connect_commands c
  where c.job_uuid = new.job_uuid
    and c.session_uuid = v_session.session_uuid and c.sequence = 3
    and c.action = 'ussd_release' and c.status = 'success'
    and c.completed_at is not null;
  if not found then return new; end if;

  if not (v_start.completed_at <= v_reply.completed_at
          and v_reply.completed_at <= v_release.completed_at)
     or v_start.station_uuid is distinct from new.station_uuid
     or v_reply.station_uuid is distinct from new.station_uuid
     or v_release.station_uuid is distinct from new.station_uuid
  then return new; end if;

  -- The first response must have precisely [amount, destination, 1, 0],
  -- in this order, without depending on its Arabic or French language.
  v_prompt := translate(coalesce(v_start.raw_response, ''),
     '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  select array_agg(m.captures[1] order by m.ord) into v_numbers
  from regexp_matches(v_prompt, '[0-9]+', 'g')
       with ordinality as m(captures,ord);
  if coalesce(array_length(v_numbers, 1), 0) <> 4
     or v_numbers[1] <> new.amount::text
     or v_numbers[2] <> new.phone
     or v_numbers[3] <> '1'
     or v_numbers[4] <> '0' then return new; end if;

  -- A successful transport reply is NOT enough. Recognize only the
  -- owner-verified carrier response, or a literal known refusal.
  v_carrier_reply := lower(trim(regexp_replace(
     replace(replace(coalesce(v_reply.raw_response,''), chr(13), ' '), chr(10), ' '),
     '[[:space:]]+', ' ', 'g')));
  v_carrier_reply := rtrim(v_carrier_reply, '.،؛!؟ ');
  v_accepted := v_carrier_reply in (
     'votre demande est prise en charge, un sms vous sera envoyé',
     'تم استلام طلبك'
  );
  v_rejected := v_carrier_reply in (
     'votre solde est insuffisant',
     'solde insuffisant',
     'votre demande a été refusée',
     'رصيد غير كاف',
     'تم رفض طلبك'
  );
  if not v_accepted and not v_rejected then return new; end if;

  new.status := case when v_accepted then 'success' else 'failed' end;
  new.result_code := case when v_accepted
    then '630_NETWORK_ACCEPTED_OPERATIONAL'
    else '630_NETWORK_REJECTED_EXPLICIT' end;
  new.result_text := left(v_reply.raw_response, 4000);
  new.technical_result := coalesce(new.technical_result, '{}'::jsonb)
    || jsonb_build_object(
       'transport','session_command',
       'financial_result', case when v_accepted then 'carrier_accepted_operational'
                           else 'carrier_explicit_rejection' end,
       'reconciliation_method','exact_closed_session_confirm_reply',
       'network_acceptance_not_final_sms',v_accepted,
       'requires_network_or_sms_reconciliation',v_accepted,
       'automatic_retry',false
    );
  return new;
end;
$fn$;

drop trigger if exists zz_flexy_mini_630_operational_ack_trg
on public.station_connect_jobs;

create trigger zz_flexy_mini_630_operational_ack_trg
before update of status, result_code, result_text
on public.station_connect_jobs
for each row
execute function private.flexy_mini_630_operational_ack_transition();
