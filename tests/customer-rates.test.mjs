import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261016123000_flexy_mini_customer_discount_rates.sql",import.meta.url),"utf8");
const source=readFileSync(new URL("../src/FlexySimulationPage.tsx",import.meta.url),"utf8");
const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("rate registry has one nullable owner and a real snapshot trigger, not live default inheritance",()=>{
  assert.match(sql,/customer_id bigint references public\.flexy_mini_customer_accounts\(id\)/);
  assert.match(sql,/where customer_id is null/);
  assert.match(sql,/where customer_id is not null/);
  assert.match(sql,/after insert on public\.flexy_mini_customer_accounts/);
  assert.match(sql,/select new\.id,service_key,discount_percent,now\(\)/);
  assert.doesNotMatch(sql,/update public\.flexy_mini_customer_accounts/i);
});
test("public raw rates are not exposed to anon or authenticated API roles",()=>{
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on public\.flexy_mini_discount_rates from PUBLIC,anon,authenticated/);
  assert.match(sql,/auth\.uid\(\) is null or not private\.is_shop_admin\(\)/);
  assert.match(sql,/grant execute on function public\.flexy_mini_admin_discount_rate_set.* to authenticated/);
});
test("rates are admin-only and simulation remains isolated from persistent writes",()=>{
  assert.match(main, /!isCustomer && \(page === "simulation" \|\| page === "rates"\)/);
  assert.match(source, /if \(production\)/);
  assert.match(source, /flexy_mini_admin_discount_rate_set/);
  assert.match(source, /flexy_mini_admin_discount_rates_read/);
  assert.match(source, /production \? \{\} : initialExamples/);
  assert.match(source, /غير محددة/);
});
test("atomic admin editor can apply the same rate to both Mobilis products",()=>{
  assert.match(sql, /p_apply_both_mobilis boolean default false/);
  assert.match(sql, /both-service change is only supported for Mobilis/);
  assert.match(source, /p_apply_both_mobilis: both/);
});
