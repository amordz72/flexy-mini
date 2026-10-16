import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(new URL("../supabase/migrations/20261016130000_flexy_mini_admin_card_price_preview.sql",import.meta.url),"utf8");
const ui = readFileSync(new URL("../src/FlexyCardQuotePreview.tsx",import.meta.url),"utf8");
const rates = readFileSync(new URL("../src/FlexySimulationPage.tsx",import.meta.url),"utf8");
const app = readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const dbRates = readFileSync(new URL("../supabase/migrations/20261016123000_flexy_mini_customer_discount_rates.sql",import.meta.url),"utf8");

test("quote SQL cannot send money or change customer state", () => {
 assert.match(sql, /language plpgsql\s+stable\s+security definer/i);
 assert.match(sql, /auth\.uid\(\) is null or not private\.is_shop_admin\(\)/);
 assert.match(sql, /customer_id=p_customer_id and service_key='card:' \|\| v_variant\.product_id::text/);
 assert.match(sql, /discount_percent/);
 assert.match(sql, /when v_rate is null then 'rate_unset'/);
 assert.match(sql, /when v_variant\.purchase_price is null or v_variant\.purchase_price <= 0 then 'purchase_price_unset'/);
 assert.match(sql, /when v_variant\.sale_price is null or v_variant\.sale_price <= 0 then 'sale_price_unset'/);
 assert.match(sql, /round\(v_variant\.sale_price \* \(1 - v_rate \/ 100\), 2\)/);
 assert.match(sql, /round\(v_charge - v_variant\.purchase_price, 2\)/);
 assert.match(sql, /'financial_dispatch_enabled',false/);
 assert.doesNotMatch(sql, /\b(insert into|update|delete from|create job|dispatch|wallet_post)\s+public\./i);
});

test("default rates are only copied at signup and never used as quote fallback", () => {
 assert.match(dbRates, /after insert on public\.flexy_mini_customer_accounts/);
 assert.match(dbRates, /where customer_id is null/);
 assert.match(sql, /customer_id=p_customer_id/);
 assert.doesNotMatch(sql, /coalesce\(\s*v_rate\s*,/i);
});

test("quote UI calls only read-only RPC; no editable cost or draft order", () => {
 assert.match(ui, /flexy_mini_admin_card_price_preview/);
 assert.match(ui, /flexy_mini_variants/);
 assert.match(ui, /لا يمكن حسابه/);
 assert.match(ui, /قبل المصاريف الأخرى/);
 assert.match(rates, /production \? \[\{ key: "preview"/);
 assert.match(app, /page === "rates" \? "إدارة نسب حقيقية/);
 assert.doesNotMatch(ui, /\.(insert|update|upsert|delete)\(/);
 assert.doesNotMatch(ui, /station_connect|wallet_post|create_order|execute_offer/);
});
