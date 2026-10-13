import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {build} from 'esbuild';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import React from 'react';
import {create,act} from 'react-test-renderer';

// Tests real StationOverview UI with fake RPCs: never use a production DB or modem.
const output=new URL('../node_modules/.station-names-tests/',import.meta.url);
await mkdir(output,{recursive:true});
const ui=`import React from 'react';
const c=name=>props=>React.createElement(name,props,props.children);
export const Alert=c('alert'),Button=c('button'),Card=c('card'),Descriptions=c('descriptions'),
 Empty=c('empty'),Select=c('select'),Tag=c('tag');
export const Input=Object.assign(c('input'),{Password:c('input-password')});
export const Space=Object.assign(c('space'),{Compact:c('space-compact')});
export const Grid={useBreakpoint:()=>({sm:true})};
export const Typography={Text:c('text')};
export const Table=props=>{
 const rows=(props.dataSource||[]).map((record,i)=>{
  const cells=(props.columns||[]).map((col,j)=>{
   const value=col.dataIndex?record[col.dataIndex]:undefined;
   return React.createElement('cell',{key:j},col.render?col.render(value,record):String(value??''));
  });
  return React.createElement('row',{key:i},cells);
 });
 return React.createElement('table',props,rows);
};
export const Modal=props=>props.open?React.createElement('modal',props,props.children):null;
export const message={success(){},warning(){},info(){},error(){}};
`;
const plugins=[{name:'stub-station-ui',setup(b){
 b.onResolve({filter:/^antd$/},()=>({path:'ui',namespace:'stub'}));
 b.onResolve({filter:/SamaOperationalActions$/},()=>({path:'actions',namespace:'stub'}));
 b.onLoad({filter:/.*/,namespace:'stub'},args=>({loader:'js',contents:args.path==='ui'?ui:'export default function Actions(){return null}'}));
}}];
const built=await build({entryPoints:['src/StationOverview.tsx'],bundle:true,write:false,
 format:'esm',platform:'node',external:['react','react/jsx-runtime'],plugins});
await writeFile(new URL('component.mjs',output),built.outputFiles[0].text);
const Station=(await import(new URL('component.mjs',output))).default;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
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
 sim_type:'mobilis-arsselli',has_pin:true,sim_last_seen_at:new Date().toISOString()}]
};
const data=x=>({data:x,error:null});
const textOf=n=>(n.children||[]).map(x=>typeof x==='string'?x:textOf(x)).join('');
function makeDb(withLabels=true){
 const calls=[];return {calls,rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='flexy_mini_station_overview')return data(fixture.stations);
  if(name==='station_connect_admin_identity_labels')return withLabels?data(fixture.labels):{data:null,error:{code:'PGRST202',message:'not deployed'}};
  if(name==='station_connect_admin_hardware')return data(args?.p_station_uuid==='s-2'?fixture.hardware2:fixture.hardware);
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
test('SIM code and user alias shown after opening station, independent of phone',async()=>{
 const db=makeDb();const root=await open(db);await click(root,'عرض');
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
test('PIN editor follows the SIM station even in all-servers mode',async()=>{
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
test('old server without names RPC keeps station list usable',async()=>{
 const db=makeDb(false),root=await open(db);
 assert.match(textOf(root.root),/WIN-PC/);
 await act(async()=>root.unmount());
});
after(async()=>rm(output,{recursive:true,force:true}));
