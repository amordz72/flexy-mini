import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const dir=await mkdtemp(join(tmpdir(),"flexy-sim-"));
const file=join(dir,"mock.mjs");
await build({entryPoints:["src/demo/mockDb.ts"],bundle:true,platform:"node",format:"esm",outfile:file});
const state=new Map();
globalThis.localStorage={
 getItem:k=>state.has(k)?state.get(k):null,
 setItem:(k,v)=>state.set(k,String(v)),
 removeItem:k=>state.delete(k)
};
const m=await import(file);
const sample="0550000001";
const station="11111111-1111-4111-8111-111111111111";
const first=(result)=>result.data?.[0];

test("demo catalog has the current 26 active offers with intact identities and distinct Sama groups",()=>{
 assert.equal(m.demoCatalog.length,26);
 assert.equal(m.demoCatalog.filter(o=>o.group_code==="PIXX").length,5);
 assert.equal(m.demoCatalog.filter(o=>o.group_code==="REVOLUTION").length,8);
 assert.equal(m.demoCatalog.filter(o=>o.group_code==="SAMA").length,13);
 assert.ok(m.demoCatalog.some(o=>o.display_name==="PixX 100 (1Go)"));
 assert.equal(m.demoCatalog.find(o=>o.display_name==="Revolution 500").execution_available,false);
});

test("cached discovery is isolated, deterministic, and avoids live network",async()=>{
 m.resetDemo();
 assert.equal(first(await m.demoDb.rpc("flexy_mini_admin_customer_offer_identity",{p_phone:sample})).lookup_status,"NEEDS_DISCOVERY");
 const group=m.getDemoGroup(sample);
 assert.equal(group,m.getDemoGroup(sample));
 const started=first(await m.demoDb.rpc("station_connect_admin_create_offer_discovery",{p_phone:sample,p_station_uuid:station}));
 assert.equal(started.status,"claimed");
 assert.equal(first(await m.demoDb.rpc("station_connect_admin_offer_discovery_job",{p_job_uuid:started.job_uuid})).status,"success");
 const cached=first(await m.demoDb.rpc("flexy_mini_admin_customer_offer_identity",{p_phone:sample}));
 assert.equal(cached.lookup_status,"CLASSIFIED"); assert.equal(cached.presentation_group,group);
 assert.equal(state.has("flexy_mini_simulator_v1"),true);
});

test("override phone group persists in localStorage, but requires new fake discovery",async()=>{
 m.setDemoGroup(sample,"REVOLUTION");
 assert.equal(m.getDemoGroup(sample),"REVOLUTION");
 assert.equal(first(await m.demoDb.rpc("flexy_mini_admin_customer_offer_identity",{p_phone:sample})).lookup_status,"NEEDS_DISCOVERY");
 await m.demoDb.rpc("station_connect_admin_create_offer_discovery",{p_phone:sample,p_station_uuid:station});
 assert.equal(first(await m.demoDb.rpc("flexy_mini_admin_customer_offer_identity",{p_phone:sample})).presentation_group,"REVOLUTION");
});

test("financial path is a local fake RPC with confirmed, failed, review outcomes and no fetch",async()=>{
 let calls=0;globalThis.fetch=()=>{calls++;throw Error("network request forbidden in lab")};
 const offer=m.demoCatalog.find(o=>o.family==="Revolution"&&o.amount===1000);
 assert.ok(offer);
 const route=first(await m.demoDb.rpc("station_connect_admin_offer_route_preview",{p_family:offer.family,p_amount:offer.amount}));
 assert.equal(route.sim_type,"mobilis-sama");
 for(const result of ["success","failed","review"]){
   m.setDemoOutcome(result);
   const queued=first(await m.demoDb.rpc("flexy_mini_admin_create_verified_offer_execute",{
     p_phone:sample,p_offer_uuid:offer.offer_uuid,p_station_uuid:station
   }));
   assert.equal(queued.status,result);
   const final=first(await m.demoDb.rpc("station_connect_admin_offer_execute_job",{p_job_uuid:queued.job_uuid}));
   assert.equal(final.status,result);
   assert.match(final.result_text,/وهمية/);
 }
 assert.equal(calls,0);
 const history=await m.demoDb.rpc("flexy_mini_admin_recent_operations",{p_limit:10,p_offset:0});
 assert.ok(history.data.length>=3);
});

test("unsupported RPC fails closed; reset clears only demo keys",async()=>{
 const out=await m.demoDb.rpc("station_connect_admin_queue_balance",{p_sim_uuid:"x"});
 assert.ok(out.error);
 m.resetDemo();
 assert.equal(state.has("flexy_mini_simulator_v1"),false);
 assert.equal(state.has("flexy_mini_admin_pending_sama_v1"),false);
});
test("cleanup",async()=>{await rm(dir,{recursive:true,force:true})});
