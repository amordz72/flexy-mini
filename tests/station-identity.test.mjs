import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {build} from 'esbuild';
import {mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import React from 'react';
import {create,act} from 'react-test-renderer';

// Tests real StationOverview UI with fake RPCs: never use a production DB or modem.
const output=new URL('../node_modules/.station-names-tests/',import.meta.url);
await mkdir(output,{recursive:true});
const ui=`import React from 'react';
const c=name=>props=>React.createElement(name,props,props.children);
export const Alert=c('alert'),Button=c('button'),
 Card=props=>React.createElement('card',props,[props.title,props.extra,props.children]),
 Descriptions=props=>React.createElement('descriptions',props,(props.items||[]).map(item=>React.createElement('field',{key:item.key},item.children))),
 Empty=c('empty'),Select=c('select'),Tag=c('tag'),Collapse=props=>React.createElement('collapse',props,(props.items||[]).map(item=>React.createElement('section',{key:item.key},item.children)));
export const Input=Object.assign(c('input'),{Password:c('input-password')});
export const Space=Object.assign(c('space'),{Compact:c('space-compact')});
export const Grid={useBreakpoint:()=>({sm:globalThis.__stationMobileMode!==true})};
export const Typography={Text:c('text')};
export const Table=props=>{
 const rows=(props.dataSource||[]).map((record,i)=>{
  const cells=(props.columns||[]).map((col,j)=>{
   const value=col.dataIndex?record[col.dataIndex]:undefined;
   return React.createElement('cell',{key:j},col.render?col.render(value,record):String(value??''));
  });
  return React.createElement('row',{key:i},cells);
 });
 const expanded=props.expandable?.expandedRowRender?(props.dataSource||[])
  .filter(record=>props.expandable.rowExpandable?.(record)!==false)
  .map((record,i)=>React.createElement('expanded-row',{key:'expanded-'+i},props.expandable.expandedRowRender(record))):[];
 return React.createElement('table',props,[...rows,...expanded]);
};
export const Modal=props=>props.open?React.createElement('modal',props,props.children):null;
export const message={success(){},warning(){},info(){},error(){}};
`;
const plugins=[{name:'stub-station-ui',setup(b){
 b.onResolve({filter:/^antd$/},()=>({path:'ui',namespace:'stub'}));
 b.onResolve({filter:/SamaOperationalActions$/},()=>({path:'actions',namespace:'stub'}));
 b.onLoad({filter:/.*/,namespace:'stub'},args=>({loader:'js',contents:args.path==='ui'?ui:'export async function readSamaStatus(){return []}; export default function Actions(){return null}'}));
}}];
const built=await build({entryPoints:['src/StationOverview.tsx'],bundle:true,write:false,
 format:'esm',platform:'node',external:['react','react/jsx-runtime'],plugins});
await writeFile(new URL('component.mjs',output),built.outputFiles[0].text);
const Station=(await import(new URL('component.mjs',output))).default;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const persistent=new Map();
globalThis.window={
 setInterval:()=>1,clearInterval:()=>{},
 localStorage:{getItem:key=>persistent.get(key)??null,setItem:(key,value)=>persistent.set(key,value),removeItem:key=>persistent.delete(key)}
};
const fixture={
 stations:[
  {station_uuid:'s-1',status:'approved',computer_name:'WIN-PC',last_seen_at:new Date().toISOString(),agent_version:'0.4.10'},
  {station_uuid:'s-2',status:'approved',computer_name:'BACKUP-PC',last_seen_at:new Date().toISOString(),agent_version:'0.4.12'}
 ],
 labels:{stations:[
 {station_uuid:'s-1',display_code:'server-1',custom_label:'6g'},
 {station_uuid:'s-2',display_code:'server-2',custom_label:'PC bach'}
 ],sims:[
 {sim_uuid:'sim-1',display_code:'sama-1',custom_label:'عمر سما1'},
 {sim_uuid:'sim-2',display_code:'arsely-2',custom_label:'رصيد المكتب'}
 ]},
 hardware:[{modem_uuid:'m-1',modem_ip:'192.168.8.1',device_name:'Huawei',
 modem_last_seen_at:new Date().toISOString(),sim_uuid:'sim-1',msisdn:'',imsi:'60301',
 sim_type:'mobilis-sama',has_pin:true,sim_last_seen_at:new Date().toISOString()}],
 hardware2:[{modem_uuid:'m-2',modem_ip:'192.168.70.70',device_name:'Huawei',
 modem_last_seen_at:new Date().toISOString(),sim_uuid:'sim-2',msisdn:'',imsi:'60301',
 sim_type:'mobilis-arsselli',has_pin:true,sim_last_seen_at:new Date().toISOString()}],
 usbDirectory:[
  {modem_uuid:'m-1',station_uuid:'s-1',usb_number:1,usb_label:'001',serial_number:'AB000004255'},
  {modem_uuid:'m-2',station_uuid:'s-2',usb_number:2,usb_label:'002',serial_number:'CD999004255'}
 ]
};
const data=x=>({data:x,error:null});
const textOf=n=>(n.children||[]).map(x=>typeof x==='string'?x:textOf(x)).join('');
function makeDb(withLabels=true,usbDirectory=fixture.usbDirectory){
 const calls=[];return {calls,auth:{getUser:async()=>({data:{user:{id:'admin-a'}},error:null})},rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='flexy_mini_station_overview')return data(fixture.stations);
  if(name==='station_connect_admin_identity_labels')return withLabels?data(fixture.labels):{data:null,error:{code:'PGRST202',message:'not deployed'}};
  if(name==='station_connect_admin_hardware')return data(args?.p_station_uuid==='s-2'?fixture.hardware2:fixture.hardware);
  if(name==='station_connect_admin_usb_sim_center')
   return usbDirectory===null?{data:null,error:{code:'PGRST202',message:'unavailable'}}:data(usbDirectory);
  if(name==='station_connect_admin_save_identity_label')return data({
   uuid:args.p_uuid,display_code:args.p_entity==='sim'?'sama-1':'server-1',custom_label:args.p_label.trim()||null});
  return data([]);
 }};
}
const open=async db=>{let root;await act(async()=>{root=create(React.createElement(Station,{db}))});return root;};
const click=async(root,label)=>{const b=root.root.findAllByType('button').find(x=>textOf(x).includes(label));assert.ok(b,label);await act(async()=>b.props.onClick());};
test('stable station code and custom alias shown; legacy Windows name not used as identity',async()=>{
 const db=makeDb();const root=await open(db);
 assert.match(textOf(root.root),/server-1/);assert.match(textOf(root.root),/6g/);
 assert.equal(db.calls.some(x=>x.name.includes('execute')),false);
 await act(async()=>root.unmount());
});
test('SIM code and user alias shown beneath the owning server without an extra click',async()=>{
 const db=makeDb();const root=await open(db);
 assert.match(textOf(root.root),/sama-1/);assert.match(textOf(root.root),/عمر سما1/);
 assert.equal(db.calls.some(x=>x.name.includes('update_sim')),false);
 await act(async()=>root.unmount());
});
test('all servers shows both modem lists and stable server names without executing commands',async()=>{
 const db=makeDb(),root=await open(db);
 assert.match(textOf(root.root),/server-1/);assert.match(textOf(root.root),/server-2/);
 assert.match(textOf(root.root),/sama-1/);assert.match(textOf(root.root),/arsely-2/);
 const hardwareCalls=db.calls.filter(x=>x.name==='station_connect_admin_hardware');
 assert.deepEqual(hardwareCalls.map(x=>x.args.p_station_uuid).sort(),['s-1','s-2']);
 assert.equal(db.calls.some(x=>/create_|update_sim|recharge|ussd|execute/.test(x.name)),false);
 await act(async()=>root.unmount());
});
test('server filter switches by station UUID and returns to all without reclassification',async()=>{
 const db=makeDb(),root=await open(db);
 const filter=()=>root.root.findAllByType('select').find(x=>x.props['aria-label']==='فلترة حسب السيرفر');
 assert.ok(filter());
 assert.deepEqual(filter().props.options.map(option=>option.label),['كل السيرفرات','server-1 — 6g','server-2 — PC bach']);
 await act(async()=>filter().props.onChange('s-2'));
 assert.match(textOf(root.root),/arsely-2/);
 assert.doesNotMatch(textOf(root.root),/sama-1/);
 await act(async()=>filter().props.onChange('all'));
 assert.match(textOf(root.root),/sama-1/);assert.match(textOf(root.root),/arsely-2/);
 assert.equal(db.calls.some(x=>/create_|update_sim|recharge|ussd|execute/.test(x.name)),false);
 await act(async()=>root.unmount());
});
test('PIN editor follows the SIM station from its expanded actions even in all-servers mode',async()=>{
 const db=makeDb(),root=await open(db);
 const buttons=root.root.findAllByType('button').filter(x=>textOf(x).includes('تغيير PIN'));
 assert.equal(buttons.length,2);
 await act(async()=>buttons[1].props.onClick());
 assert.ok(root.root.findAllByType('modal').some(x=>x.props.title==='PIN خدمة الشريحة'));
 assert.equal(db.calls.some(x=>x.name==='station_connect_admin_update_sim'),false);
 await act(async()=>root.unmount());
});
test('editing alias calls only admin label RPC, never changes SIM type/PIN or executes USSD',async()=>{
 const db=makeDb();const root=await open(db);
 await click(root,'تسمية');
 const input=root.root.findAllByType('input').find(x=>x.props['aria-label']==='الاسم الخاص');
 assert.ok(input);
 await act(async()=>input.props.onChange({target:{value:'PC bach'}}));
 const modal=root.root.findByType('modal');
 await act(async()=>modal.props.onOk());
 assert.equal(db.calls.filter(x=>x.name==='station_connect_admin_save_identity_label').length,1);
 assert.deepEqual(db.calls.find(x=>x.name==='station_connect_admin_save_identity_label').args,
  {p_entity:'station',p_uuid:'s-1',p_label:'PC bach'});
 assert.equal(db.calls.some(x=>/create_|update_sim|recharge|ussd|execute/.test(x.name)),false);
 assert.match(textOf(root.root),/PC bach/);
 await act(async()=>root.unmount());
});
test('last chosen server persists for this signed-in administrator across reload',async()=>{
 persistent.clear();
 const db=makeDb(),root=await open(db);
 const filter=()=>root.root.findAllByType('select').find(x=>x.props['aria-label']==='فلترة حسب السيرفر');
 await act(async()=>filter().props.onChange('s-2'));
 assert.equal(persistent.get('flexy-mini:station-filter:admin-a'),'s-2');
 await act(async()=>root.unmount());
 const next=await open(makeDb());
 assert.equal(next.root.findAllByType('select').find(x=>x.props['aria-label']==='فلترة حسب السيرفر').props.value,'s-2');
 assert.doesNotMatch(textOf(next.root),/sama-1/);
 assert.match(textOf(next.root),/arsely-2/);
 await act(async()=>next.unmount());
 persistent.clear();
});
test('page has no separate Sama list; only SIM-scoped actions can dispatch commands',async()=>{
 const db=makeDb(),root=await open(db);
 const view=textOf(root.root);
 assert.doesNotMatch(view,/شرائح Sama/);
 assert.match(view,/المودمات والشرائح/);
 assert.equal(db.calls.some(x=>/queue_balance|set_sim_flexy_approval|recharge|ussd|execute/.test(x.name)),false);
 await act(async()=>root.unmount());
});
test('old server without names RPC keeps station list usable',async()=>{
 const db=makeDb(false),root=await open(db);
 assert.match(textOf(root.root),/WIN-PC/);
 await act(async()=>root.unmount());
});

test('mobile modem cards contain exactly one details Collapse per physical modem',async()=>{
 globalThis.__stationMobileMode=true;
 let root;
 try{
  root=await open(makeDb());
  const modemCards=root.root.findAllByType('card').filter(node=>node.findAllByType('collapse').length===1);
  assert.equal(modemCards.length,2,'two modem cards for two hardware records');
  assert.equal(root.root.findAllByType('collapse').length,2);
  for(const modem of modemCards){
   assert.equal(modem.findAllByType('collapse').length,1,'one details section inside each modem');
  }
  assert.match(textOf(modemCards[0]),/sama-1/);
  assert.match(textOf(modemCards[1]),/arsely-2/);
 }finally{
  if(root)await act(async()=>root.unmount());
  delete globalThis.__stationMobileMode;
 }
});
test('USB and serial suffixes come from canonical modem identities, not list order or IP',async()=>{
 globalThis.__stationMobileMode=true;
 let root;
 try{
  const db=makeDb();root=await open(db);
  assert.match(textOf(root.root),/USB 001/);
  assert.match(textOf(root.root),/USB 002/);
  // Colliding last six digits (004255) must expand for an unambiguous serial check.
  assert.match(textOf(root.root),/Serial: 0004255/);
  assert.match(textOf(root.root),/Serial: 9004255/);
  assert.equal(db.calls.filter(x=>x.name==='station_connect_admin_usb_sim_center').length,1);
  const readNames=db.calls.map(x=>x.name);
  assert.equal(readNames.some(x=>/create_|update_sim|queue_balance|execute|recharge|ussd/.test(x)),false);
  const filter=root.root.findAllByType('select').find(x=>x.props['aria-label']==='فلترة حسب السيرفر');
  await act(async()=>filter.props.onChange('s-2'));
  assert.doesNotMatch(textOf(root.root),/USB 001/);
  assert.match(textOf(root.root),/USB 002/);
  assert.equal(db.calls.filter(x=>x.name==='station_connect_admin_usb_sim_center').length,1,
   'changing the filter only changes visibility, not stable USB identity');
 }finally{
  if(root)await act(async()=>root.unmount());
  delete globalThis.__stationMobileMode;
 }
});
test('desktop modem table uses the same stable USB and serial identity',async()=>{
 const root=await open(makeDb());
 assert.match(textOf(root.root),/USB 001/);
 assert.match(textOf(root.root),/USB 002/);
 assert.match(textOf(root.root),/Serial: 0004255/);
 await act(async()=>root.unmount());
});
test('unknown identity or missing serial never fabricates labels from table order',async()=>{
 globalThis.__stationMobileMode=true;
 let missing,failed;
 try{
  missing=await open(makeDb(true,[
   {modem_uuid:'m-1',station_uuid:'s-1',usb_number:21,usb_label:'021',serial_number:null}
  ]));
  assert.match(textOf(missing.root),/USB 021/);
  assert.match(textOf(missing.root),/Serial: غير مقروء/);
  assert.match(textOf(missing.root),/USB غير متاح/); // second modem was not mapped
  await act(async()=>missing.unmount());missing=null;
  failed=await open(makeDb(true,null));
  assert.doesNotMatch(textOf(failed.root),/USB 001|USB 002/);
  assert.match(textOf(failed.root),/USB غير متاح/);
  const warnings=failed.root.findAllByType('alert').map(x=>x.props.message).filter(Boolean);
  assert.ok(warnings.some(x=>x.includes('تعذر قراءة رقم USB')));
 }finally{
  if(missing)await act(async()=>missing.unmount());
  if(failed)await act(async()=>failed.unmount());
  delete globalThis.__stationMobileMode;
 }
});
test('same full Serial is explicitly flagged as ambiguous even with different USB labels',async()=>{
 const rows=[
  {modem_uuid:'m-1',station_uuid:'s-1',usb_number:1,usb_label:'001',serial_number:'SAME_SERIAL'},
  {modem_uuid:'m-2',station_uuid:'s-2',usb_number:2,usb_label:'002',serial_number:'SAME_SERIAL'}
 ];
 const root=await open(makeDb(true,rows));
 assert.match(textOf(root.root),/USB 001/);
 assert.match(textOf(root.root),/USB 002/);
 assert.equal((textOf(root.root).match(/\(متكرر\)/g)||[]).length,2);
 await act(async()=>root.unmount());
});
test('CSS applies full-height only to grid cards, not all nested modem cards',async()=>{
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.app-content\s+\.ant-card\s*\{\s*height\s*:\s*100%/);
 assert.match(css,/\.app-content\s+\.ant-row\s*>\s*\.ant-col\s*>\s*\.ant-card\s*\{\s*height\s*:\s*100%/);
});
after(async()=>rm(output,{recursive:true,force:true}));
