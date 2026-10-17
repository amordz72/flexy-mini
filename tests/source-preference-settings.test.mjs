import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const page=readFileSync(new URL("../src/OfferSourcePreferenceSettings.tsx",import.meta.url),"utf8");
const shell=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("routing source editor uses the existing React/Ant Design settings page",()=>{
  const result=ts.transpileModule(page,{compilerOptions:{
    jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,
  },reportDiagnostics:true});
  assert.ok(result.outputText.includes("jsx"));
  assert.deepEqual((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
  assert.match(shell,/React\.lazy\(\(\) => import\("\.\/OfferSourcePreferenceSettings"\)\)/);
  assert.match(shell,/page === "settings" \? <Space/);
  assert.match(shell,/<OfferSourcePreferenceSettings db=\{client\}\/>/);
});
test("routing config uses admin RPC, explicit confirmation, and stale update token",()=>{
  assert.match(page,/db\.rpc\("flexy_mini_admin_offer_source_preference"\)/);
  assert.match(page,/db\.rpc\("flexy_mini_admin_save_offer_source_preference"/);
  assert.match(page,/p_expected_updated_at:loaded\.updated_at/);
  assert.match(page,/title="تأكيد تغيير أولوية التنفيذ"/);
  assert.match(page,/onOk=\{\(\)=>void save\(\)\}/);
  assert.match(page,/split>=1 && split<=50000/);
  assert.doesNotMatch(page,/db\.from\(/);
});
test("630 ordinary, 696 Arsselli offers and 665 Sama offers are kept independent",()=>{
  assert.match(page,/630 للرصيد العادي/);
  assert.match(page,/696 لعروض Arsselli/);
  assert.match(page,/665 لعروض Sama/);
  assert.match(page,/ولا ترسل شحنًا ولا تغيّر نسب العملاء/);
  assert.doesNotMatch(page,/\b(?:ussd_start|ussd_reply|station_connect_admin_create_offer_execute)\b/);
});
