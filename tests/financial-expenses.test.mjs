import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261016171500_flexy_mini_operating_expenses.sql",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/FinancialExpenses.tsx",import.meta.url),"utf8");
const report=readFileSync(new URL("../src/FinancialReports.tsx",import.meta.url),"utf8");

test("expense registry is scoped to Flexy Mini and has RLS, not shared MyTool",()=>{
 assert.match(sql,/create table public\.flexy_mini_operating_expenses/);
 assert.match(sql,/alter table public\.flexy_mini_operating_expenses enable row level security/);
 assert.match(sql,/revoke all on public\.flexy_mini_operating_expenses from PUBLIC,anon,authenticated/);
 assert.match(sql,/amount numeric\(14,2\) not null check \(amount > 0/);
 assert.doesNotMatch(sql,/\b(insert into|update|delete from)\s+(?:public\.)?(?:sales|money_operations|cash_place_operations|flexy_orders|flexy_mini_customer_wallet_ledger)/i);
});
test("admins only, idempotent create, cancellable with audit and no permanent deletion",()=>{
 assert.equal((sql.match(/if auth\.uid\(\) is null or not private\.is_shop_admin\(\)/g)||[]).length,3);
 assert.match(sql,/request_key uuid not null unique/);
 assert.match(sql,/on conflict \(request_key\) do nothing/);
 assert.match(sql,/Request key already used for a different expense/);
 assert.match(sql,/set voided_at=now\(\),voided_by=auth\.uid\(\),void_reason=btrim\(p_reason\)/);
 assert.match(sql,/coalesce\(sum\(amount\) filter\(where voided_at is null\),0\)/);
 assert.match(sql,/revoke all on function public\.flexy_mini_admin_expense_create.* from PUBLIC,anon/);
 assert.match(sql,/revoke all on function public\.flexy_mini_admin_expense_void.* from PUBLIC,anon/);
 assert.doesNotMatch(sql,/delete from public\.flexy_mini_operating_expenses/i);
});
test("UI saves only expense RPCs; other platform money and net remains independent",()=>{
 assert.match(ui,/flexy_mini_admin_expense_create/);
 assert.match(ui,/flexy_mini_admin_expense_void/);
 assert.match(ui,/flexy_mini_admin_expenses_list/);
 assert.match(ui,/crypto\.randomUUID\(\)/);
 assert.match(ui,/active_total/);
 assert.match(ui,/سبب الإلغاء/);
 assert.match(ui,/p_expense_date: draft.date/);
 assert.match(report,/FinancialExpenses db=\{db\} from=\{applied.from\} to=\{applied.to\}/);
 assert.match(report,/غير مكتمل — لا يمكن حسابه/);
 assert.match(report,/ارجع إلى سجل مصاريف Flexy Mini الخاص بالفترة/);
 assert.doesNotMatch(ui,/\.from\(|\.insert\(|\.update\(|wallet_post|station_connect|create_order/);
});
