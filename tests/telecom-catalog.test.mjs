import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const shell=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const catalog=readFileSync(new URL("../src/TelecomCatalogAdmin.tsx",import.meta.url),"utf8");

test("catalog uses the existing React / Ant Design screen, not a parallel app or schema",()=>{
  const output=ts.transpileModule(catalog,{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},
    reportDiagnostics:true
  });
  assert.ok(output.outputText.includes("jsx"));
  assert.deepEqual((output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
  assert.match(shell,/const TelecomCatalogAdmin = React\.lazy/);
  assert.match(shell,/\{key:"telecom-catalog",icon:<PhoneOutlined\/>,label:"الاتصالات والشبكات"\}/);
  assert.match(shell,/page === "telecom-catalog" && client \? <DeferredPanel><TelecomCatalogAdmin db=\{client\}\/>/);
  assert.match(shell,/const customerItems = items\.filter\(group=>group\.label==="الخدمات"\)/);
  assert.match(shell,/const validPages = new Set\(\[[^\n]*"telecom-catalog"/);
});

test("read-only catalog uses canonical admin guarded RPCs and never executes carrier or wallet actions",()=>{
  for(const rpc of [
    "station_connect_admin_operators",
    "station_connect_admin_sim_types",
    "admin_flexy_list_offer_catalog",
    "admin_flexy_offer_execution_routes",
    "admin_flexy_offer_source_matrix",
    "mytool_admin_ussd_codes_list"
  ]) assert.ok(catalog.includes('db.rpc("'+rpc+'"'),rpc);
  assert.doesNotMatch(catalog,/db\.from\(/);
  assert.doesNotMatch(catalog,/db\.(?:insert|update|upsert|delete)\(/);
  assert.doesNotMatch(catalog,/db\.rpc\("(?:station_connect_admin_create|flexy_mini_admin_create|station_connect_admin_stage|mytool_admin_ussd_code_bind_sim_type)/);
  assert.doesNotMatch(catalog,/\b(?:exec\(|sendUssd|queueCommand|financePost)\b/);
  assert.doesNotMatch(catalog,/mytool-dev|\.\/\.\.\/mytool-dev/);
});

test("offers and SIM types stay separate identities, and an offer without routes stays on unfiltered catalog",()=>{
  assert.match(catalog,/rowKey="offer_uuid"/);
  assert.match(catalog,/rowKey="route_uuid"/);
  assert.match(catalog,/rowKey="ussd_uuid"/);
  assert.match(catalog,/offer_uuid === offer\.offer_uuid/);
  assert.match(catalog,/if \(simType !== "all" &&/);
  assert.match(catalog,/عرض واحد لكل هوية تجارية/);
  assert.match(catalog,/غياب المسار لا يحذف العرض/);
  assert.match(catalog,/حالة المسار في الكاتالوج لا تثبت وجود شريحة متصلة/);
  assert.doesNotMatch(catalog,/\b(?:Dima|Gold)\b/);
  assert.doesNotMatch(catalog,/amount\s*[<>]=?\s*500/);
});

test("separate USSD code knowledge from execution permission, no write or live send controls",()=>{
  assert.match(catalog,/label: "الأكواد التشغيلية"/);
  assert.match(catalog,/knowledge_status/);
  assert.match(catalog,/implementation_status/);
  assert.match(catalog,/توثيق صحة الكود مستقل عن السماح بالشحن/);
  assert.match(catalog,/دون اختبار شبكة أو تنفيذ USSD/);
  assert.match(catalog,/pagination=\{\{ pageSize: 10, showSizeChanger: false \}\}/);
});
