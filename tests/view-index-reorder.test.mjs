import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql=readFileSync(new URL("../supabase/migrations/20261017150000_flexy_mini_admin_offer_view_index_reorder.sql",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/TelecomCatalogAdmin.tsx",import.meta.url),"utf8");
const customer=readFileSync(new URL("../src/FlexyServicePage.tsx",import.meta.url),"utf8");

test("View Index changes only the canonical offer order within its operator and family",()=>{
  assert.match(sql,/function public\.flexy_mini_admin_offer_view_reorder\(/);
  assert.match(sql,/from public\.flexy_offer_catalog/);
  assert.match(sql,/where operator=v_offer\.operator and family=v_offer\.family/);
  assert.match(sql,/v_new := pg_catalog\.array_append/);
  assert.match(sql,/set sort_index = ranked\.position::integer/);
  assert.match(sql,/c\.sort_index is distinct from ranked\.position::integer/);
  assert.doesNotMatch(sql,/\b(?:update|insert into|delete from)\s+(?:public\.)?(?:flexy_offer_execution_routes|station_connect_jobs|flexy_mini_customer_wallets|flexy_orders)\b/i);
  assert.doesNotMatch(sql,/\bset\s+network_index\b/i);
  assert.doesNotMatch(sql,/create table|alter table/i);
});

test("reorder is admin-authenticated, validates bounds, and guards concurrent edits",()=>{
  assert.match(sql,/auth\.uid\(\) is null or not private\.is_shop_admin\(\)/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/p_expected_updated_at/);
  assert.match(sql,/VIEW_ORDER_STALE_RELOAD/);
  assert.match(sql,/VIEW_POSITION_OUT_OF_RANGE/);
  assert.match(sql,/revoke all on function public\.flexy_mini_admin_offer_view_reorder\(uuid,integer,timestamptz\) from PUBLIC,anon;/);
  assert.match(sql,/grant execute on function public\.flexy_mini_admin_offer_view_reorder\(uuid,integer,timestamptz\) to authenticated;/);
});

test("admin modal requires explicit confirmation, previews same-family reordering, and refreshes",()=>{
  assert.match(ui,/title="تأكيد تعديل View Index"/);
  assert.match(ui,/onOk=\{\(\) => void saveViewOrder\(\)\}/);
  assert.match(ui,/onCancel=\{\(\) =>/);
  assert.match(ui,/p_expected_updated_at: editingOffer\.updated_at/);
  assert.match(ui,/p_offer_uuid: editingOffer\.offer_uuid/);
  assert.match(ui,/p_target_position: targetPosition/);
  assert.match(ui,/setRefresh\(value => value \+ 1\)/);
  assert.match(ui,/setEditingOffer\(null\)/);
  assert.match(ui,/لن يتغير Network Index/);
  assert.doesNotMatch(ui,/\.(?:insert|upsert|delete|update)\(/);
});

test("customer offer order uses sort_index rather than amount or execution network_index",()=>{
  assert.match(customer,/a\.sort_index \?\? 999999/);
  assert.match(customer,/b\.sort_index \?\? 999999/);
  assert.doesNotMatch(customer,/a\.family === b\.family \? a\.amount-b\.amount/);
  assert.match(customer,/const chosen = eligibleOffers\.find/);
  assert.match(customer,/const samaRoute = Boolean/);
});
