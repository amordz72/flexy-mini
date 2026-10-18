import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=readFileSync(new URL(
 "../supabase/migrations/20261017211000_flexy_recent_operations_include_direct_630.sql",
 import.meta.url),"utf8");
const history=readFileSync(new URL("../src/FlexyOperationHistory.tsx",import.meta.url),"utf8");
const flexy=readFileSync(new URL("../src/FlexyServicePage.tsx",import.meta.url),"utf8");

test("existing operations table includes direct 630 and discriminates old review-only staging",()=>{
 assert.match(migration,/'mobilis\.flexy\.ordinary\.630'\)/);
 assert.match(migration,/when j\.operation_key='mobilis\.flexy\.ordinary\.630'\s+and j\.result_code='630_NETWORK_SEQUENCE_UNVERIFIED'\s+then 'prepared'/);
 assert.match(migration,/طلب تحضيري فقط؛ لم يُرسل أي رصيد/);
 assert.match(migration,/vault\.decrypted_secrets/);
 assert.match(migration,/private\.is_shop_admin/);
 assert.match(migration,/replace\(coalesce\(c\.raw_response,''\),secret\.decrypted_secret/);
 assert.doesNotMatch(migration,/update\s+public\.station_connect_jobs/i);
 assert.doesNotMatch(migration,/insert into\s+public\.station_connect_jobs/i);
});
test("status UI distinguishes NOT SENT from real post-network REVIEW and does not hide history",()=>{
 assert.match(history,/prepared:"لم يُرسل"/);
 assert.match(history,/review:"نتيجة الشبكة غير مؤكدة"/);
 assert.match(history,/flexy_mini_admin_recent_operations/);
 assert.match(history,/const state = \(value:string\) => <Tag/);
 assert.match(flexy,/station_connect_admin_send_arsselli_630/);
 assert.match(flexy,/station_connect_admin_630_credit_job/);
 assert.doesNotMatch(flexy,/station_connect_admin_stage_arsselli_630/);
 assert.doesNotMatch(flexy,/station_connect_admin_dispatch_630_test_once/);
 assert.doesNotMatch(flexy,/station_connect_admin_630_test_gate_status/);
});

test("direct 630 keeps an unresolved intent across reload and never auto-resends it",()=>{
 assert.match(flexy,/flexy_mini_admin_pending_630_v1/);
 assert.match(flexy,/const recoveredCredit630=useRef/);
 assert.match(flexy,/useState\(Boolean\(recoveredCredit630\.current\)\)/);
 assert.match(flexy,/saveCredit630Pending\(pending\);[\s\S]*?db\.rpc\("station_connect_admin_send_arsselli_630"/);
 assert.match(flexy,/prior\.phone===recipient && prior\.amount===amount/);
 assert.match(flexy,/!\["success","failed"\]\.includes\(prior\.status\)/);
 assert.match(flexy,/station_connect_admin_630_credit_job/);
 const confirmCode=flexy.slice(flexy.indexOf("const confirmCredit630Send = async"),
   flexy.indexOf("useEffect(() => {",flexy.indexOf("const confirmCredit630Send = async")));
 assert.match(confirmCode,/station_connect_admin_send_arsselli_630/);
});
test("unchanged amount control cannot reset the direct-630 send lock",()=>{
 assert.match(flexy,/onClick=\{\(\) => \{if\(amount===value\)return;/);
 assert.match(flexy,/onChange=\{value => \{if\(amount===value\)return;/);
});

test("known no-confirmation 630 failure releases the browser lock after server reconciliation",()=>{
 const start=flexy.indexOf('}else if(status==="failed"){');
 const end=flexy.indexOf('}else{',start);
 const branch=flexy.slice(start,end);
 assert.match(branch,/String\(job\.result_code\|\|""\)==="630_CONFIRMATION_NOT_SENT"/);
 assert.match(branch,/String\(job\.result_code\|\|""\)==="630_CONFIRMATION_NOT_SENT_NO_DEBIT_632"/);
 assert.match(branch,/if\(notSent \|\| explicitRejection\)/);
 assert.match(branch,/630_NETWORK_REJECTED_EXPLICIT/);
 assert.match(branch,/setCreditSendAttempted\(false\)/);
 assert.match(branch,/creditRequestKey\.current=null/);
 // Still depends on server terminal status, never self-resolves reviews.
 assert.match(flexy,/else if\(status==="review"\)/);
 assert.match(flexy,/station_connect_admin_630_credit_job/);
});


const operationalSql=readFileSync(new URL(
 "../supabase/migrations/20261018123000_flexy_mini_630_operational_ack_settlement.sql",
 import.meta.url),"utf8");
test("630 settlement belongs to the Flexy server, never the Agent or gateway",()=>{
 assert.match(operationalSql,/create or replace function private\.flexy_mini_630_operational_ack_transition/);
 assert.match(operationalSql,/before update of status, result_code, result_text/);
 assert.match(operationalSql,/old\.status <> 'claimed'/);
 assert.match(operationalSql,/new\.status <> 'review'/);
 assert.match(operationalSql,/new\.source_app <> 'flexy-mini'/);
 assert.match(operationalSql,/new\.operation_key <> 'mobilis\.flexy\.ordinary\.630'/);
 assert.match(operationalSql,/new\.payload->>'dispatch_mode' <> 'direct_630'/);
 assert.doesNotMatch(operationalSql,/queue_session_command|ussd_reply\s*\(/i);
});
test("the original amount and recipient and a single successful 1 must match the same closed session",()=>{
 assert.match(operationalSql,/v_session\.status <> 'closed'/);
 assert.match(operationalSql,/v_session\.station_uuid is distinct from new\.station_uuid/);
 assert.match(operationalSql,/v_count <> 3/);
 assert.match(operationalSql,/c\.sequence = 1/);
 assert.match(operationalSql,/c\.sequence = 2/);
 assert.match(operationalSql,/c\.sequence = 3/);
 assert.match(operationalSql,/c\.value = '1'/);
 assert.match(operationalSql,/array_length\(v_numbers, 1\), 0\) <> 4/);
 assert.match(operationalSql,/v_numbers\[1\] <> new\.amount::text/);
 assert.match(operationalSql,/v_numbers\[2\] <> new\.phone/);
 assert.match(operationalSql,/v_numbers\[3\] <> '1'/);
 assert.match(operationalSql,/v_numbers\[4\] <> '0'/);
});
test("carrier exact acceptance yields operational success, uncertain result stays review",()=>{
 assert.match(operationalSql,/votre demande est prise en charge, un sms vous sera envoyé/);
 assert.match(operationalSql,/تم استلام طلبك/);
 assert.match(operationalSql,/if not v_accepted and not v_rejected then return new/);
 assert.match(operationalSql,/new\.status := case when v_accepted then 'success' else 'failed' end/);
 assert.match(operationalSql,/630_NETWORK_ACCEPTED_OPERATIONAL/);
 assert.match(operationalSql,/network_acceptance_not_final_sms/);
 assert.match(operationalSql,/automatic_retry',false/);
 assert.doesNotMatch(operationalSql,/update\s+public\.station_connect_arsselli_account_balances/i);
 assert.doesNotMatch(operationalSql,/update\s+public\.station_connect_jobs/i);
});

test("630 follows the same accepted job quickly; 20 seconds warns rather than failing or cancelling",()=>{
 const start=flexy.indexOf('    // The time budget is for the UI warning');
 const end=flexy.indexOf('  const loadCatalog = useCallback',start);
 const polling=flexy.slice(start,end);
 assert.ok(start>0 && end>start);
 assert.match(polling,/station_connect_admin_630_credit_job/);
 assert.match(polling,/status==="success" \|\| status==="failed"/);
 assert.match(polling,/630_NETWORK_ACCEPTED_OPERATIONAL/);
 assert.match(polling,/Date\.now\(\)-since>=20000/);
 assert.match(polling,/العملية قيد التحقق، وليست فاشلة/);
 assert.match(polling,/elapsed<20000\?3000:elapsed<120000\?10000:30000/);
 assert.match(polling,/window\.setTimeout/);
 assert.doesNotMatch(polling,/Date\.now\(\)-since<120000\)void poll/);
 assert.doesNotMatch(polling,/station_connect_admin_send_arsselli_630|ussd_start|ussd_reply/);
 assert.doesNotMatch(polling,/setCreditDirectJobUuid\(/);
});

test("one slow 630 result does not freeze SIM, assume a DATA fallback, or re-send money",()=>{
 const start=flexy.indexOf('    // The time budget is for the UI warning');
 const end=flexy.indexOf('  const loadCatalog = useCallback',start);
 const polling=flexy.slice(start,end);
 assert.match(polling,/else if\(status==="review"\)/);
 assert.match(polling,/لا تعاود إرسالها/);
 assert.match(polling,/const explicitRejection=/);
 assert.match(polling,/setCreditSendAttempted\(false\)/);
 assert.doesNotMatch(polling,/freeze|block_sim|suspend_sim|switch_to_DATA/i);
 assert.doesNotMatch(polling,/db\.rpc\("[^"]*send/i);
});
