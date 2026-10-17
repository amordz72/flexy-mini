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
 const start=flexy.indexOf('} else if(status==="failed")');
 const end=flexy.indexOf('} else {',start);
 const branch=flexy.slice(start,end);
 assert.match(branch,/String\(job\.result_code\|\|""\)==="630_CONFIRMATION_NOT_SENT"/);
 assert.match(branch,/String\(job\.result_code\|\|""\)==="630_CONFIRMATION_NOT_SENT_NO_DEBIT_632"/);
 assert.match(branch,/if\(notSent\)/);
 assert.match(branch,/setCreditSendAttempted\(false\)/);
 assert.match(branch,/creditRequestKey\.current=null/);
 // Still depends on server terminal status, never self-resolves reviews.
 assert.match(flexy,/else if\(status==="review"\)/);
 assert.match(flexy,/station_connect_admin_630_credit_job/);
});
