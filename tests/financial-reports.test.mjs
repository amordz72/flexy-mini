import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(new URL("../supabase/migrations/20261016131500_flexy_mini_admin_financial_report.sql",import.meta.url),"utf8");
const ui = readFileSync(new URL("../src/FinancialReports.tsx",import.meta.url),"utf8");
const shell = readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("reports are source-owned: existing Flexy orders only, no shared sales/wallet/station union",()=>{
  assert.match(sql, /from public\.flexy_orders o/g);
  assert.doesNotMatch(sql, /\b(join|union(?: all)?)\s+(?:public\.)?(?:sales|station_connect_jobs|flexy_mini_customer_wallet_ledger|mytool_service_orders)\b/i);
  assert.match(sql, /'shared_sales',false/);
  assert.match(sql, /'station_jobs',false/);
  assert.match(sql, /'cards_and_games',false/);
  assert.match(sql, /'idoom',false/);
});
test("admin-only stable, read-only RPC uses Algeria calendar boundaries",()=>{
  assert.match(sql, /language plpgsql\s+stable\s+security definer/);
  assert.match(sql, /auth\.uid\(\) is null or not private\.is_shop_admin\(\)/);
  assert.match(sql, /p_from::timestamp at time zone 'Africa\/Algiers'/);
  assert.match(sql, /\(p_to \+ 1\)::timestamp at time zone 'Africa\/Algiers'/);
  assert.match(sql, /revoke all on function public\.flexy_mini_admin_financial_report\(date,date,text,text\) from PUBLIC,anon/);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate)\s+(?:into\s+|from\s+)?(?:public\.|private\.)/i);
});
test("cannot turn nominal/review money into booked profit and never treats unknown as zero",()=>{
  assert.match(sql, /case when count\(\*\) filter \(where status='success'\) > 0/);
  assert.match(sql, /count\(\*\) filter \(where status='success' and profit_amount is null\)=0/);
  assert.match(sql, /'expenses',null,'net_profit',null/);
  assert.match(sql, /'inferred_success_count'/);
  assert.match(sql, /ilike '%ASSUMED%'/);
  assert.match(sql, /ilike '%INFERRED%'/);
  assert.match(ui, /غير مكتمل — لا يمكن حسابه/);
  assert.match(ui, /حالات ناجحة تقنيًا|الحالات الناجحة تقنيًا/);
});
test("only admin navigation, no writable data inputs or application wallet mutation",()=>{
  assert.match(shell, /\{key:"reports",icon:<HistoryOutlined\/>/);
  assert.ok(shell.includes('page === "reports" && client ? <DeferredPanel><FinancialReports db={client}/>'));
  assert.match(ui, /flexy_mini_admin_financial_report/);
  assert.match(ui, /type="date"/);
  assert.match(ui, /الاستهلاك/);
  assert.match(ui, /الأرباح والمصاريف/);
  assert.doesNotMatch(ui,/\.(insert|update|upsert|delete)\(/);
  assert.doesNotMatch(ui,/station_connect|wallet_post|create_order|execute_offer/);
});
