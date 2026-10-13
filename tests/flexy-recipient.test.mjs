import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { build } from 'esbuild';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import React from 'react';
import { create, act } from 'react-test-renderer';

// Exercise real component effects/RPC contracts with isolated transport and UI stubs.
// Never connect these tests to Supabase or a physical Station.
const output = new URL('../node_modules/.flexy-tests/', import.meta.url);
await mkdir(output, { recursive: true });
const ui = `import React from 'react';
const c = name => props => React.createElement(name, props, props.children);
export const Alert=c('alert'), Button=c('button'), Card=c('card'), Table=c('table'), Descriptions=c('descriptions'), Col=c('col'), Empty=c('empty'), Input=c('input'), InputNumber=c('amount'), Row=c('row'), Segmented=c('segmented'), Select=c('select'), Space=c('space'), Spin=c('spin'), Tag=c('tag'), Radio=c('radio');
export const Collapse=props=>React.createElement('collapse',props,(props.items||[]).map(item=>React.createElement('panel',{key:item.key,label:item.label},item.children)));
export const List=Object.assign(props=>React.createElement('list',props,(props.dataSource||[]).map(row=>props.renderItem(row))),{Item:c('list-item')});
export const Typography={Text:c('text'),Paragraph:c('paragraph')};
export const Modal=props=>props.open?React.createElement('modal',props,props.children):null;
export const message={warning(){},success(){},info(){},error(){}};`;
const plugins = [{ name:'test-ui', setup(b) {
  b.onResolve({filter:/^antd$/},()=>({path:'ui',namespace:'stub'}));
  b.onResolve({filter:/^@ant-design\/icons$/},()=>({path:'icons',namespace:'stub'}));
  b.onResolve({filter:/SamaOfferDiscoveries$/},()=>({path:'history',namespace:'stub'}));
  b.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='ui'?ui:args.path==='history'?'export default function History(){return null}':`import React from 'react'; const Icon=()=>null; export {Icon as CheckCircleOutlined,Icon as PhoneOutlined,Icon as ReloadOutlined,Icon as SearchOutlined,Icon as InfoCircleOutlined};`,loader:'js'}));
}}];
for (const component of ['CustomerOfferIdentity','FlexyServicePage','FlexyOperationHistory']) {
  const result = await build({entryPoints:[`src/${component}.tsx`],bundle:true,write:false,format:'esm',platform:'node',external:['react','react/jsx-runtime'],plugins});
  await writeFile(new URL(`${component}.mjs`,output),result.outputFiles[0].text);
}
const Identity=(await import(new URL('CustomerOfferIdentity.mjs',output))).default;
const History=(await import(new URL('FlexyOperationHistory.mjs',output))).default;
const Flexy=(await import(new URL('FlexyServicePage.mjs',output))).default;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const timers=new Map(); let timerId=0;
globalThis.window={setInterval:fn=>{timers.set(++timerId,fn);return timerId},clearInterval:id=>timers.delete(id),localStorage:{getItem:()=>null,setItem(){},removeItem(){}}};
const future=new Date(Date.now()+86400000).toISOString();
const classified={lookup_status:'CLASSIFIED',presentation_group:'PIXX',discovery_uuid:'discovery',discovered_at:new Date().toISOString(),valid_until:future,active_job_uuid:null};
const missing={lookup_status:'NEEDS_DISCOVERY',presentation_group:null,active_job_uuid:null};
const ok=data=>({data:Array.isArray(data)?data:[data],error:null});
const flush=()=>act(async()=>{await Promise.resolve();await Promise.resolve()});
const texts=node=>node.children.map(x=>typeof x==='string'?x:texts(x)).join('');
const button=(r,text)=>r.root.findAllByType('button').find(n=>texts(n).includes(text));
const click=async(r,text)=>{const b=button(r,text);assert.ok(b,`Button ${text}`);assert.ok(!b.props.disabled);await act(async()=>{await b.props.onClick()})};
const mount=async(Component,props)=>{let r;await act(async()=>{r=create(React.createElement(Component,props))});await flush();return r};
const close=async r=>act(async()=>r.unmount());
const makeDb=handler=>{const calls=[];return {calls,rpc:(name,args)=>{calls.push({name,args});return handler(name,args)}}};
const base={phone:'0500000001',stationUuid:'station',isCustomer:false,active:true,requestToken:1,onIdentity:()=>{}};

test('default is credit; one LTR phone normalizes +213; changing number restores credit',async()=>{
  const db=makeDb(name=>Promise.resolve(ok(name==='flexy_get_visible_offer_catalog_v2'?[]:name==='flexy_mini_admin_sama_readiness'?[]:missing)));
  const r=await mount(Flexy,{db,isCustomer:false});
  assert.equal(r.root.findByType('segmented').props.value,'credit');
  const phone=r.root.findAllByType('input').find(n=>n.props['aria-label']==='رقم الهاتف المراد شحنه');
  assert.equal(phone.props.dir,'ltr');
  await act(async()=>phone.props.onChange({target:{value:'+213 500 00 00 01'}}));
  assert.equal(phone.props.value,'0500000001');
  assert.equal(db.calls.filter(x=>x.name.includes('customer_offer_identity')).length,0);
  await act(async()=>r.root.findByType('segmented').props.onChange('offers'));
  await flush();
  assert.equal(db.calls.filter(x=>x.name.includes('customer_offer_identity')).length,1);
  await act(async()=>phone.props.onChange({target:{value:'0500000002'}}));
  assert.equal(r.root.findByType('segmented').props.value,'credit');
  assert.equal(db.calls.filter(x=>x.name.includes('create_offer')).length,0);
  await close(r);
});

test('valid cache supplies same recipient group without network discovery',async()=>{
  let identity;
  const db=makeDb(()=>Promise.resolve(ok(classified)));
  const r=await mount(Identity,{...base,db,onIdentity:value=>{identity=value}});
  assert.equal(identity.phone,base.phone);assert.equal(identity.group,'PIXX');
  assert.equal(db.calls.length,1);assert.equal(button(r,'تأكيد الاستعلام'),undefined);
  await close(r);
});

test('missing cache presents confirmation; double confirmation dispatches once; poll publishes result',async()=>{
  let identity;let resolveQueue;let complete=false;
  const db=makeDb(name=>{
    if(name==='flexy_mini_admin_customer_offer_identity')return Promise.resolve(ok(complete?classified:missing));
    if(name==='station_connect_admin_create_offer_discovery')return new Promise(resolve=>{resolveQueue=resolve});
    if(name==='station_connect_admin_offer_discovery_job'){complete=true;return Promise.resolve(ok({job_uuid:'job',status:'success',result_code:'DISCOVERY_COMPLETE'}))}
    throw Error(name);
  });
  const r=await mount(Identity,{...base,db,onIdentity:v=>{identity=v}});
  assert.equal(db.calls.length,1);
  const confirm=button(r,'تأكيد الاستعلام').props.onClick;
  await act(async()=>{confirm();confirm()});
  assert.equal(db.calls.filter(x=>x.name==='station_connect_admin_create_offer_discovery').length,1);
  assert.equal(db.calls.at(-1).args.p_phone,base.phone);
  await act(async()=>resolveQueue(ok({job_uuid:'job',status:'claimed',reused:false})));
  assert.equal(timers.size,1);
  await act(async()=>{for(const tick of [...timers.values()])tick();await Promise.resolve()});await flush();
  assert.equal(identity.group,'PIXX');assert.equal(timers.size,0);
  assert.equal(db.calls.filter(x=>x.name==='station_connect_admin_create_offer_discovery').length,1);
  await close(r);
});

test('late cached response cannot restore previous phone identity',async()=>{
  let resolveLookup;const seen=[];
  const db=makeDb(()=>new Promise(resolve=>{resolveLookup=resolve}));
  const onIdentity=v=>seen.push(v);
  const r=await mount(Identity,{...base,db,onIdentity});
  await act(async()=>r.update(React.createElement(Identity,{...base,phone:'0500000002',active:false,db,onIdentity})));
  await act(async()=>resolveLookup(ok(classified)));
  assert.equal(seen.filter(Boolean).length,0);
  await close(r);
});

test('lost queue response blocks another discovery until existing job is recovered',async()=>{
  let recover=false;
  const db=makeDb(name=>name==='station_connect_admin_create_offer_discovery'?Promise.reject(Error('lost')):Promise.resolve(ok(recover?{...missing,lookup_status:'IN_PROGRESS',active_job_uuid:'job'}:missing)));
  const r=await mount(Identity,{...base,db});await click(r,'تأكيد الاستعلام');
  assert.equal(button(r,'استكشاف العروض').props.disabled,true);
  recover=true;await click(r,'تحديث النتيجة');
  assert.equal(timers.size,1);assert.equal(db.calls.filter(x=>x.name.includes('create_offer')).length,1);
  await close(r);
});

test('late queued response and job polling cannot publish state for changed recipient',async()=>{
  let resolveQueue;const db=makeDb(name=>name.includes('create_offer')?new Promise(resolve=>{resolveQueue=resolve}):Promise.resolve(ok(missing)));
  const r=await mount(Identity,{...base,db});
  await act(async()=>{button(r,'تأكيد الاستعلام').props.onClick()});
  await act(async()=>r.update(React.createElement(Identity,{...base,phone:'0500000002',active:false,db})));
  await act(async()=>resolveQueue(ok({job_uuid:'old-job',status:'claimed'})));
  assert.equal(timers.size,0);assert.equal(r.root.findAllByType('tag').length,0);
  await close(r);
});

test('customer cannot access administrative discovery RPC',async()=>{
  const db=makeDb(()=>{throw Error('Unexpected admin RPC')});
  const r=await mount(Identity,{...base,db,isCustomer:true});
  assert.equal(db.calls.length,0);await close(r);
});

test('expired cache cannot authorize offer selection',async()=>{
  let identity;
  const db=makeDb(()=>Promise.resolve(ok({...classified,valid_until:'2020-01-01T00:00:00Z'})));
  const r=await mount(Identity,{...base,db,onIdentity:v=>{identity=v}});
  assert.equal(identity,null);assert.ok(button(r,'تأكيد الاستعلام'));
  assert.equal(db.calls.filter(x=>x.name.includes('create_offer')).length,0);await close(r);
});

test('failed discovery remains unknown and polling never queues a retry',async()=>{
  const db=makeDb(name=>Promise.resolve(ok(name==='flexy_mini_admin_customer_offer_identity'
    ?missing:name==='station_connect_admin_create_offer_discovery'
    ?{job_uuid:'job',status:'claimed'}:{job_uuid:'job',status:'failed',result_code:'NETWORK_ERROR'})));
  const r=await mount(Identity,{...base,db});await click(r,'تأكيد الاستعلام');
  await act(async()=>{for(const tick of [...timers.values()])tick();await Promise.resolve()});await flush();
  assert.equal(timers.size,0);assert.ok(r.root.findAllByType('alert').some(n=>String(n.props.message).includes('NETWORK_ERROR')));
  assert.equal(db.calls.filter(x=>x.name.includes('create_offer')).length,1);await close(r);
});

test('polling is bounded and pending job prevents a new discovery',async()=>{
  const db=makeDb(()=>Promise.resolve(ok({...missing,lookup_status:'IN_PROGRESS',active_job_uuid:'job'})));
  const r=await mount(Identity,{...base,db});
  const tick=[...timers.values()][0];assert.ok(tick);
  for(let i=0;i<61;i++)await act(async()=>{tick();await Promise.resolve()});
  assert.equal(timers.size,0);assert.equal(button(r,'استكشاف العروض').props.disabled,true);
  assert.equal(db.calls.filter(x=>x.name.includes('create_offer')).length,0);await close(r);
});

test('financial REVIEW retains pending intent and offers no reset/new request action',async()=>{
  window.localStorage.getItem=()=>JSON.stringify({fingerprint:'existing',key:'previous-intent',job:{job_uuid:'financial-job',status:'review'}});
  const db=makeDb(name=>Promise.resolve(ok(name==='flexy_get_visible_offer_catalog_v2'||name==='flexy_mini_admin_sama_readiness'?[]:missing)));
  const r=await mount(Flexy,{db,isCustomer:false});
  await act(async()=>r.root.findByType('segmented').props.onChange('offers'));await flush();
  assert.equal(button(r,'طلب جديد بعد مراجعة'),undefined);
  assert.equal(button(r,'إرسال العرض').props.disabled,true);
  assert.equal(db.calls.filter(x=>x.name.includes('create_verified_offer_execute')).length,0);
  await close(r);window.localStorage.getItem=()=>null;
});

test('history is visible by default with raw response and all essential columns',async()=>{
 const record={job_uuid:'history-job',phone:'0500000001',service:'استكشاف عروض',offer_name:'—',amount:null,status:'unavailable',result_code:'DISCOVERY_TERMINAL',result_text:'Please Enter your PIN code',created_at:new Date().toISOString(),responses:[{sequence:1,action:'ussd_start',status:'success',response:'Please Enter your PIN code',created_at:new Date().toISOString()}],total_count:21};
 const db=makeDb(()=>Promise.resolve(ok(record)));
 const r=await mount(History,{db});const table=r.root.findByType('table');
 assert.deepEqual(table.props.columns.map(c=>c.title),['التاريخ','الرقم','الخدمة','اسم العرض','المبلغ','الحالة','رد الشبكة','رمز النتيجة']);
 assert.equal(table.props.dataSource[0].result_text,record.result_text);
 assert.deepEqual(db.calls[0].args,{p_limit:10,p_offset:0});
 assert.equal(table.props.pagination.total,21);
 await act(async()=>table.props.pagination.onChange(2));await flush();
 assert.deepEqual(db.calls.at(-1).args,{p_limit:10,p_offset:10});
 assert.ok(table.props.expandable.rowExpandable(record));await close(r);
});


const catalogOffer=(family,amount,enabled=true)=>({
  offer_uuid:`${family}-${amount}`,operator:'mobilis',family,
  group_code:family.startsWith('Sama')?'SAMA':family.toUpperCase(),
  amount,display_name:`${family} ${amount}`,
  network_index:enabled?'1':null,details:`Catalog details ${amount}`,
  execution_enabled:enabled,execution_available:enabled,
  execution_sim_types:enabled?['mobilis-sama']:[],
});
const flexyDb=(group,offers)=>{
  const identity={...classified,presentation_group:group};
  return makeDb((name)=>{
    if(name==='flexy_get_visible_offer_catalog_v2')return Promise.resolve(ok(offers));
    if(name==='flexy_mini_admin_sama_readiness')return Promise.resolve(ok([]));
    if(name==='flexy_mini_admin_customer_offer_identity')return Promise.resolve(ok(identity));
    if(name==='station_connect_admin_offer_route_preview')return Promise.resolve(ok(null));
    throw new Error('Unexpected RPC '+name);
  });
};
const setRecipientAndOffers=async(r)=>{
  const phone=r.root.findAllByType('input').find(n=>n.props['aria-label']==='رقم الهاتف المراد شحنه');
  await act(async()=>phone.props.onChange({target:{value:'0500000001'}}));
  await act(async()=>r.root.findByType('segmented').props.onChange('offers'));await flush();
};

test('Sama catalog is one collapsible group with internal Mix/Talk/Net families, not three long cards',async()=>{
  const db=flexyDb('SAMA',[catalogOffer('Sama Mix',100),catalogOffer('Sama Mix',500),
    catalogOffer('Sama Talk',500),catalogOffer('Sama Net',1000)]);
  const r=await mount(Flexy,{db,isCustomer:false});
  await setRecipientAndOffers(r);
  const boxes=r.root.findAllByType('card');
  assert.equal(boxes.filter(c=>c.props.title==='عروض الزبون').length,0);
  assert.equal(boxes.filter(c=>c.props.title==='العروض المتاحة').length,1);
  const outer=r.root.findAllByType('collapse').find(c=>c.props.items[0]?.key==='sama');
  assert.ok(outer); assert.equal(outer.props.items.length,1);
  const inner=r.root.findAllByType('collapse').find(c=>c.props.accordion);
  assert.ok(inner); assert.deepEqual(inner.props.items.map(x=>x.label),['Sama Mix','Sama Talk','Sama Net']);
  assert.ok(r.root.findAllByType('list').some(n=>n.props.dataSource.some(o=>o.amount===100)));
  assert.equal(db.calls.filter(x=>x.name.includes('create_offer')).length,0);
  await close(r);
});

test('Revolution keeps role-visible 100 DZD & 500 DZD catalog rows when Sama is absent; no silent ordinary recharge',async()=>{
  const db=flexyDb('REVOLUTION',[catalogOffer('Revolution',100,false),catalogOffer('Revolution',500,false),catalogOffer('Revolution',1000)]);
  const r=await mount(Flexy,{db,isCustomer:false});await setRecipientAndOffers(r);
  const list=r.root.findByType('list');
  assert.deepEqual(list.props.dataSource.map(o=>o.amount),[100,500,1000]);
  assert.equal(r.root.findAllByType('collapse').length,0);
  assert.equal(r.root.findAllByType('select').length,0);
  await click(r,'Revolution 100');
  assert.equal(button(r,'إرسال العرض').props.disabled,true);
  assert.equal(db.calls.filter(x=>x.name.includes('create_verified_offer_execute')).length,0);
  await close(r);
});

test('PixX 50/100/500 display complete catalog names and details without starting USSD',async()=>{
  const offers=[catalogOffer('PixX',50),catalogOffer('PixX',100),catalogOffer('PixX',500)];
  offers[1].display_name='PixX 100 (1Go)';
  const db=flexyDb('PIXX',offers);
  const r=await mount(Flexy,{db,isCustomer:false});await setRecipientAndOffers(r);
  const list=r.root.findByType('list');
  assert.deepEqual(list.props.dataSource.map(o=>display_name),offers.map(o=>o.display_name));
  const detailButton=r.root.findAllByType('button').find(x=>x.props['aria-label']==='تفاصيل PixX 100 (1Go)');
  await act(async()=>detailButton.props.onClick());
  assert.ok(r.root.findAllByType('modal').some(x=>x.props.title==='PixX 100 (1Go)'));
  assert.equal(db.calls.filter(x=>x.name.includes('create_offer')).length,0);
  await close(r);
});

after(()=>rm(output,{recursive:true,force:true}));
