import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

const source=readFileSync(new URL("../supabase/functions/flexy-mini-customers/index.ts",import.meta.url),"utf8");
const frontend=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const js=ts.transpileModule(source.replace(/^import \{ createClient \} from [^\n]+\n/,""),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText;
const sha256=value=>createHash("sha256").update(value).digest("hex");
const token="a".repeat(64),deviceSecret="b".repeat(64);
const future=()=>new Date(Date.now()+60*60*1000).toISOString();
const past=()=>new Date(Date.now()-60*60*1000).toISOString();

function data(){
 return {
  flexy_mini_customer_sessions:[{id:5,customer_id:1,device_id:9,token_hash:sha256(token),expires_at:future(),revoked_at:null}],
  flexy_mini_trusted_devices:[{id:9,customer_id:1,credential_hash:sha256(deviceSecret),approved_at:past(),revoked_at:null,expires_at:future()}],
  flexy_mini_customer_accounts:[{id:1,active:true,username:"fixture_user"}],
  flexy_mini_categories:[{id:1,name:"Games",sort_index:1,active:true},{id:2,name:"Inactive",sort_index:2,active:false}],
  flexy_mini_products:[
   {id:10,category_id:1,name:"Visible",sort_index:1,active:true,display_mode:"visible",is_frozen:false},
   {id:11,category_id:1,name:"Hidden",sort_index:2,active:true,display_mode:"hidden",is_frozen:false},
   {id:12,category_id:1,name:"Frozen",sort_index:3,active:true,display_mode:"visible",is_frozen:true},
   {id:13,category_id:1,name:"Disabled",sort_index:4,active:false,display_mode:"visible",is_frozen:false},
   {id:14,category_id:2,name:"Parent category off",sort_index:5,active:true,display_mode:"visible",is_frozen:false}
  ],
  flexy_mini_variants:[
   {id:101,product_id:10,name:"Available",sort_index:2,denomination:500,stock_quantity:3,active:true,display_mode:"visible",is_frozen:false,purchase_price:100},
   {id:107,product_id:10,name:"Earlier",sort_index:1,denomination:200,stock_quantity:1,active:true,display_mode:"visible",is_frozen:false},
   {id:102,product_id:10,name:"Frozen item",sort_index:3,denomination:700,stock_quantity:2,active:true,display_mode:"visible",is_frozen:true},
   {id:103,product_id:10,name:"Hidden item",sort_index:4,denomination:800,stock_quantity:2,active:true,display_mode:"hidden",is_frozen:false},
   {id:104,product_id:11,name:"Hidden parent",sort_index:1,denomination:900,stock_quantity:2,active:true,display_mode:"visible",is_frozen:false},
   {id:105,product_id:12,name:"Frozen parent",sort_index:1,denomination:1000,stock_quantity:2,active:true,display_mode:"visible",is_frozen:false},
   {id:106,product_id:14,name:"Disabled category",sort_index:1,denomination:1100,stock_quantity:2,active:true,display_mode:"visible",is_frozen:false}
  ]
 };
}

function service(records){
 let handler;
 const touched=[];
 function createClient(){
  return {from(table){
   touched.push(table);
   let fields=[],filters=[],orders=[];
   const rows=()=>{
    let result=(records[table]||[]).filter(row=>filters.every(([field,value])=>row[field]===value));
    for(let i=orders.length-1;i>=0;i--){
     const [key,ascending]=orders[i];
     result=[...result].sort((a,b)=>((a[key]??0)>(b[key]??0)?1:(a[key]??0)<(b[key]??0)?-1:0)*(ascending?1:-1));
    }
    return result.map(row=>Object.fromEntries(fields.map(field=>[field,row[field]])));
   };
   const query={
    select(names){fields=names.split(",").map(s=>s.trim());return query;},
    eq(field,value){filters.push([field,value]);return query;},
    order(key,{ascending=true}={}){orders.push([key,ascending]);return query;},
    async maybeSingle(){return {data:rows()[0]||null,error:null};},
    then(resolve,reject){return Promise.resolve({data:rows(),error:null}).then(resolve,reject);},
    update(){throw new Error("Read-only catalog must not modify state");},
    insert(){throw new Error("Read-only catalog must not insert state");}
   };
   return query;
  }};
 }
 vm.runInNewContext(js,{
  createClient,Deno:{env:{get:()=> "fixture"},serve:fn=>{handler=fn;}},
  TextEncoder,Response,Request,crypto:webcrypto,console
 },{timeout:5000});
 assert.equal(typeof handler,"function");
 return {touched,async post(payload){
   const response=await handler(new Request("https://local.test",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"catalog",...payload})
   }));
   return {status:response.status,body:await response.json()};
 }};
}

test("valid approved customer sees only active visible unfrozen catalog in index order",async()=>{
 const app=service(data()),result=await app.post({token,device_secret:deviceSecret});
 assert.equal(result.status,200);
 assert.deepEqual(result.body.categories.map(c=>c.id),[1]);
 assert.deepEqual(result.body.products.map(p=>p.id),[10]);
 assert.deepEqual(result.body.variants.map(v=>v.id),[107,101]);
 assert.equal("purchase_price" in result.body.variants[0],false);
 assert.equal(app.touched.includes("flexy_mini_customer_wallets"),false);
});
test("catalog rejects absent/invalid session token or wrong device secret",async()=>{
 const app=service(data());
 for(const payload of [{},{token:"invalid",device_secret:deviceSecret},{token,device_secret:"wrong"}]){
  assert.equal((await app.post(payload)).status,401);
 }
});
test("catalog rejects revoked/expired sessions, revoked/expired/unapproved devices and disabled accounts",async()=>{
 const cases=[
  x=>{x.flexy_mini_customer_sessions[0].revoked_at=past();},
  x=>{x.flexy_mini_customer_sessions[0].expires_at=past();},
  x=>{x.flexy_mini_trusted_devices[0].revoked_at=past();},
  x=>{x.flexy_mini_trusted_devices[0].expires_at=past();},
  x=>{x.flexy_mini_trusted_devices[0].approved_at=null;},
  x=>{x.flexy_mini_customer_accounts[0].active=false;}
 ];
 for(const mutate of cases){const records=data();mutate(records);
  assert.equal((await service(records).post({token,device_secret:deviceSecret})).status,401);
 }
});
test("frontend supplies same device proof as customer me action, and buying stays disabled",()=>{
 assert.match(frontend,/action:"catalog",token,device_secret:window\.localStorage\.getItem\("flexy_mini_device_secret"\)/);
 assert.match(frontend,/شراء البطاقات غير مفعّل/);
});
