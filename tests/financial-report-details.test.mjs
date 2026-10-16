import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20261016163000_flexy_mini_admin_financial_report_orders.sql",import.meta.url),"utf8");
const page = readFileSync(new URL("../src/FinancialReports.tsx",import.meta.url),"utf8");
const detail = readFileSync(new URL("../src/FinancialReportOrders.tsx",import.meta.url),"utf8");
test("financial order detail is read-only, admin-scoped, and paginated",()=>{
  assert.match(sql,/language plpgsql stable security definer/);
  assert.match(sql,/auth\.uid\(\) is null or not private\.is_shop_admin\(\)/);
  assert.match(sql,/from public\.flexy_orders o/g);
  assert.match(sql,/p_offset is null or p_offset < 0/);
  assert.match(sql,/p_limit is null or p_limit not between 1 and 50/);
  assert.match(sql,/p_from::timestamp at time zone 'Africa\/Algiers'/);
  assert.match(sql,/\(p_to \+ 1\)::timestamp at time zone 'Africa\/Algiers'/);
  assert.match(sql,/revoke all on function public\.flexy_mini_admin_financial_report_orders.* from PUBLIC,anon/);
  assert.doesNotMatch(sql,/\b(insert into|update public\.|delete from|wallet_post|station_connect_jobs|from public\.sales|union all)\b/i);
  assert.doesNotMatch(sql,/o\.phone|o\.result_text|\braw_response\b|\bpin\b/i);
});
test("only snapshots are shown; inferred successes remain flagged",()=>{
  assert.match(sql,/recorded_profit/);
  assert.match(sql,/recorded_sale_price/);
  assert.match(sql,/inferred_success/);
  assert.match(sql,/ilike '%ASSUMED%'/);
  assert.match(sql,/ilike '%INFERRED%'/);
  assert.match(detail,/نجاح مستنتج/);
  assert.match(detail,/غير متوفر/);
  assert.match(detail,/pageSize: 10/);
  assert.match(detail,/flexy_mini_admin_financial_report_orders/);
  assert.doesNotMatch(detail,/\.insert\(|\.update\(|\.delete\(|wallet_post|station_connect/);
});
test("exports only the selected summary and protects CSV from formula injection",()=>{
  assert.match(page,/exportSummaryCsv/);
  assert.match(page,/تصدير ملخص CSV/);
  assert.match(page,/اختيار الشهر مباشرة/);
  assert.match(page,/FinancialReportOrders/);
  assert.match(page,/window\.print\(\)/);
  assert.match(page,/new Blob\(\[csv\]/);
  assert.match(page,/content\.replace\(\/"\/g/);
  assert.match(page,/content\)\) content =/);
  assert.match(page,/report\.source/);
  assert.match(page,/report\.summary/);
  assert.doesNotMatch(page,/wallet_post|station_connect_jobs|create_order/);
});
