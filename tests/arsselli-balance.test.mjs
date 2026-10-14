import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {build} from 'esbuild';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import React from 'react';
import {create,act} from 'react-test-renderer';

const output=new URL('../node_modules/.arsselli-balance-tests/',import.meta.url);
await mkdir(output,{recursive:true});
const ui=`import React from 'react';
const c=name=>props=>React.createElement(name,props,props.children);
export const Alert=c('alert'),Button=c('button'),Tag=c('tag'),Space=c('space'),Typography={Text:c('text')};
export const Descriptions=props=>React.createElement('descriptions',props,(props.items||[]).map(item=>React.createElement('field',{key:item.key,label:item.label},item.children)));
export const Collapse=props=>React.createElement('collapse',props,(props.items||[]).map(item=>React.createElement('section',{key:item.key},item.children)));
export const message={info(){},success(){},warning(){},error(){}};
`;
const plugins=[{name:'arsselli-ui',setup(b){
 b.onResolve({filter:/^antd$/},()=>({path:'ui',namespace:'stub'}));
 b.onLoad({filter:/.*/,namespace:'stub'},()=>({loader:'js',contents:ui}));
}}];
const built=await build({entryPoints:['src/ArsselliBalanceActions.tsx'],bundle:true,write:false,
 format:'esm',platform:'node',external:['react','react/jsx-runtime'],plugins});
await writeFile(new URL('component.mjs',output),built.outputFiles[0].text);
const Arsselli=(await import(new URL('component.mjs',output))).default;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const result=(rows)=>({data:rows,error:null});
const textOf=node=>(node.children||[]).map(v=>typeof v==='string'?v:textOf(v)).join('');
const mount=async(props)=>{let r;await act(async()=>{r=create(React.createElement(Arsselli,props))});return r};
const press=async(r,label)=>{const b=r.root.findAllByType('button').find(x=>textOf(x).includes(label));assert.ok(b,label);assert.notEqual(b.props.disabled,true,label);await act(async()=>await b.props.onClick());};
const close=async r=>act(async()=>r.unmount());
const saved=[{account_key:'code:04',distributor_account_code:'04',account_name:'GTS',balance_amount:0,currency:'DZD',checked_at:'2026-10-12T10:00:00Z'},
 {account_key:'code:05',distributor_account_code:'05',account_name:'MOBILIS',balance_amount:200,currency:'DZD',checked_at:'2026-10-12T10:00:00Z'}];
const dbFor=(opts={})=>{
 const calls=[];return {calls,rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='station_connect_admin_arsselli_balances')return result(opts.saved??saved);
  if(name==='station_connect_admin_arsselli_recent_responses')return result(opts.history??[]);
  if(name==='station_connect_admin_queue_arsselli_balance'){
   if(opts.throwOnQueue)throw Error('lost transport');
   return result([{job_uuid:'job-one',status:'queued'}]);
  }
  if(name==='station_connect_admin_arsselli_balance_job')
   return result([{job_uuid:'job-one',status:'review',result_code:'BALANCE_SMS_PENDING',result_text:'SMS not confirmed'}]);
  throw Error('Unexpected RPC '+name);
 }};};
test('display GTS separately from other distributor account balances, including valid zero',async()=>{
 const db=dbFor(),r=await mount({db,simUuid:'sim-1',canRequestBalance:false});
 assert.match(textOf(r.root),/GTS \(04\)/);
 assert.match(textOf(r.root),/MOBILIS/);
 assert.match(textOf(r.root),/200 دج/);
 assert.match(textOf(r.root),/0 دج/);
 assert.equal(db.calls.filter(x=>x.name.includes('queue')).length,0);
 await close(r);
});
test('offline SIM never offers a working query or silently enqueues a job',async()=>{
 const db=dbFor({saved:[]}),r=await mount({db,simUuid:'sim-1',canRequestBalance:false});
 assert.match(textOf(r.root),/لم يُقرأ بعد/);
 const btn=r.root.findAllByType('button').find(x=>textOf(x).includes('قراءة رصيد أرسلي عبر الشبكة'));
 assert.equal(btn.props.disabled,true);
 assert.equal(db.calls.filter(x=>x.name.includes('queue')).length,0);
 await close(r);
});
test('real network request requires explicit two-stage confirmation; pending SMS is not a balance',async()=>{
 const db=dbFor({saved:[]}),r=await mount({db,simUuid:'sim-1',canRequestBalance:true});
 assert.equal(db.calls.filter(x=>x.name.includes('queue')).length,0);
 await press(r,'قراءة رصيد أرسلي عبر الشبكة');
 assert.equal(db.calls.filter(x=>x.name.includes('queue')).length,0);
 await press(r,'تأكيد الآن');
 assert.equal(db.calls.filter(x=>x.name==='station_connect_admin_queue_arsselli_balance').length,1);
 assert.deepEqual(db.calls.find(x=>x.name==='station_connect_admin_queue_arsselli_balance').args,{p_sim_uuid:'sim-1'});
 assert.equal(r.root.findAllByType('button').find(x=>textOf(x).includes('قراءة رصيد أرسلي عبر الشبكة')).props.disabled,true);
 await press(r,'تحديث حالة الطلب');
 assert.match(textOf(r.root),/لم تتأكد رسالة SMS جديدة/);
 assert.match(textOf(r.root),/لم يُقرأ بعد/);
 assert.equal(db.calls.filter(x=>x.name.includes('queue')).length,1);
 await close(r);
});
test('lost queue response locks out automatic and immediate repeated requests',async()=>{
 const db=dbFor({saved:[],throwOnQueue:true}),r=await mount({db,simUuid:'sim-1',canRequestBalance:true});
 await press(r,'قراءة رصيد أرسلي عبر الشبكة');await press(r,'تأكيد الآن');
 assert.equal(db.calls.filter(x=>x.name.includes('queue')).length,1);
 const btn=r.root.findAllByType('button').find(x=>textOf(x).includes('قراءة رصيد أرسلي عبر الشبكة'));
 assert.equal(btn.props.disabled,true);
 assert.match(textOf(r.root),/غير مؤكدة/);
 await close(r);
});
test('a preexisting queued job is recovered instead of silently duplicated after reload',async()=>{
 const history=[{job_uuid:'old-job',status:'claimed',result_code:null,result_text:null,response_kind:'result',created_at:'2026-10-14T12:00:00Z'}];
 const db=dbFor({saved:[],history}),r=await mount({db,simUuid:'sim-1',canRequestBalance:true});
 assert.equal(db.calls.filter(x=>x.name.includes('queue')).length,0);
 assert.equal(r.root.findAllByType('button').find(x=>textOf(x).includes('قراءة رصيد أرسلي عبر الشبكة')).props.disabled,true);
 assert.match(textOf(r.root),/old-job/);
 await close(r);
});
after(async()=>rm(output,{recursive:true,force:true}));
