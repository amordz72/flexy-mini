/**
 * OFFLINE DEMO ONLY. This adapter intentionally has no Supabase client, fetch,
 * modem transport, credentials, payment keys, or real-network fallback.
 * It implements the exact RPC names consumed by the real FlexyServicePage.
 * All mock phone identities/jobs/history are isolated in localStorage.
 */
export type DemoGroup = "PIXX" | "REVOLUTION" | "SAMA";
export type DemoOutcome = "success" | "failed" | "review";
type DemoPhone = { group: DemoGroup; at: string };
type DemoJob = { job_uuid:string; status:string; result_code:string; result_text:string;
  phone:string; service:string; offer_name:string; amount:number|null; created_at:string };
type DemoState = { phones: Record<string,DemoPhone>; jobs:Record<string,DemoJob>; operations:DemoJob[]; outcome:DemoOutcome };
const KEY = "flexy_mini_simulator_v1";
const DEFAULT:DemoState = {phones:{},jobs:{},operations:[],outcome:"success"};
const load = ():DemoState => {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<DemoState>|null;
    if (!data || typeof data !== "object") return structuredClone(DEFAULT);
    return {phones:data.phones||{},jobs:data.jobs||{},operations:data.operations||[],outcome:data.outcome||"success"};
  } catch { return structuredClone(DEFAULT); }
};
const save = (data:DemoState) => localStorage.setItem(KEY,JSON.stringify(data));
export const resetDemo = () => {localStorage.removeItem(KEY);localStorage.removeItem("flexy_mini_admin_pending_sama_v1");};
export const setDemoOutcome = (outcome:DemoOutcome) => {const data=load();data.outcome=outcome;save(data);};
export const currentDemoOutcome = () => load().outcome;
export const getDemoGroup = (phone:string):DemoGroup => load().phones[phone]?.group || (["PIXX","REVOLUTION","SAMA"] as const)[(Array.from(phone).reduce((a,c)=>((a*31+c.charCodeAt(0))>>>0),7))%3];
export const setDemoGroup = (phone:string,group:DemoGroup) => {
  const data=load();delete data.phones[phone];data.phones[phone]={group,at:""};save(data);
};
export const newDemoPhone = ():string => {
  // Visual-only 10-digit example; generated numbers NEVER leave the browser.
  return "055" + String(Math.floor(Math.random()*10000000)).padStart(7,"0");
};
type Offer = {offer_uuid:string;operator:string;family:string;group_code:DemoGroup;amount:number;
 display_name:string;network_index:string|null;details:string;sort_index:number;
 execution_enabled:boolean;execution_available:boolean;execution_sim_types:string[]};
const rows:(readonly [string,number,string?,string?])[]=[
  ["PixX",50,"PixX 50","500Mo — يوم واحد"],
  ["PixX",100,"PixX 100 (1Go)","1Go — يوم واحد"],
  ["PixX",500,"PixX 500 (5Go)","5Go — 15 يومًا"],
  ["PixX",1000,"PixX 1000 (13Go)","13Go — 30 يومًا"],
  ["PixX",2000,"PixX 2000 (30Go)","30Go"],
  ["Revolution",100],["Revolution",500],["Revolution",1000],
  ["Revolution",1200],["Revolution",1500],["Revolution",1800],
  ["Revolution",2000],["Revolution",2500],
  ["Sama Mix",100,"Sama Mix 100","500Mo — يوم واحد"],
  ["Sama Mix",500,"Sama Mix 500","5Go — 15 يومًا"],
  ["Sama Mix",1000,"Sama Mix 1000","15Go — 30 يومًا"],
  ["Sama Mix",1500,"Sama Mix 1500","30Go — 30 يومًا"],
  ["Sama Mix",2000,"Sama Mix 2000","50Go — 30 يومًا"],
  ["Sama Talk",500,"Sama Talk 500","500Mo — 15 يومًا"],
  ["Sama Talk",1000,"Sama Talk 1000","2Go — 30 يومًا"],
  ["Sama Talk",1500,"Sama Talk 1500","3Go — 30 يومًا"],
  ["Sama Talk",2000,"Sama Talk 2000","4Go — 30 يومًا"],
  ["Sama Net",500,"Sama Net 500","10Go — 15 يومًا"],
  ["Sama Net",1000,"Sama Net 1000","30Go — 30 يومًا"],
  ["Sama Net",1500,"Sama Net 1500","60Go — 30 يومًا"],
  ["Sama Net",2000,"Sama Net 2000","90Go — 30 يومًا"],
];
const groupOf = (f:string):DemoGroup => f==="PixX"?"PIXX":f==="Revolution"?"REVOLUTION":"SAMA";
export const demoCatalog:Offer[] = rows.map(([family,amount,name,details],i)=>{
  // Demo uses synthetic IDs. Keep offer identity / display_name / amount compatible with the actual catalog.
  const index=family==="Revolution"&&amount===100||family==="Revolution"&&amount===500?null:String(i+1);
  const enabled=!(family==="Revolution"&&amount===500);
  return {
    offer_uuid:"sim-"+family.toLowerCase().replaceAll(" ","-")+"-"+amount,
    operator:"mobilis",family,group_code:groupOf(family),amount,
    display_name:name||family+" "+amount,network_index:index,
    details:details||"اسم ومبلغ من كتالوج Mobilis المحفوظ — بيانات محاكاة",
    sort_index:i,execution_enabled:enabled,execution_available:enabled&&Boolean(index),
    execution_sim_types:enabled&&index?["mobilis-sama"]:[],
  };
});
const STATION="11111111-1111-4111-8111-111111111111";
const SIM="22222222-2222-4222-8222-222222222222";
const good=(data:unknown)=>({data,error:null});
const fail=(error:string)=>({data:null,error:{message:error}});
const isPhone=(phone:string)=>/^0[5-7]\d{8}$/.test(phone);
const validGroup=(v:string):v is DemoGroup=>v==="PIXX"||v==="REVOLUTION"||v==="SAMA";
const record=(state:DemoState,job:DemoJob)=>{
  state.jobs[job.job_uuid]=job;
  state.operations=[job,...state.operations].slice(0,100);
  save(state);
};
/** Mock in-process adapter. NEVER substitute a real db client or forward unknown RPCs. */
export const demoDb = {
  async rpc(name:string,args:Record<string,unknown>={}):Promise<{data:any;error:any}> {
    const state=load();
    if(name==="flexy_get_visible_offer_catalog_v2") return good(demoCatalog);
    if(name==="flexy_mini_admin_sama_readiness")return good([{
      station_uuid:STATION,station_name:"محطة المحاكاة",station_online:true,
      sim_uuid:SIM,sim_type:"mobilis-sama",mobilis_network:true,
      modem_online:true,sim_online:true,has_service_pin:true,flexy_approved:true,
      balance_initialized:true,operational_balance:999999,
      balance_reconciliation_due:false,discover_ready:true,execute_prerequisites_ready:true,
    }]);
    if(name==="flexy_mini_admin_customer_offer_identity"){
      const phone=String(args.p_phone||"");const found=state.phones[phone];
      if (!found||!found.at) return good([{lookup_status:"NEEDS_DISCOVERY",presentation_group:null,
        discovery_uuid:null,discovered_at:null,valid_until:null,active_job_uuid:null}]);
      const at=new Date(found.at), until=new Date(at.getTime()+7*86400000);
      if (until.getTime()<Date.now()) return good([{lookup_status:"NEEDS_DISCOVERY",presentation_group:null,
        discovery_uuid:null,discovered_at:null,valid_until:null,active_job_uuid:null}]);
      return good([{lookup_status:"CLASSIFIED",presentation_group:found.group,
        detected_family:found.group,discovery_uuid:"33333333-3333-4333-8333-333333333333",
        discovered_at:at.toISOString(),valid_until:until.toISOString(),active_job_uuid:null}]);
    }
    if(name==="station_connect_admin_create_offer_discovery"){
      const phone=String(args.p_phone||"");
      if(!isPhone(phone)||args.p_station_uuid!==STATION)return fail("رقم أو محطة محاكاة غير صالحين");
      const group=getDemoGroup(phone);
      state.phones[phone]={group,at:new Date().toISOString()};
      const id=crypto.randomUUID();
      record(state,{job_uuid:id,status:"claimed",result_code:"SIM_DISCOVERY",result_text:"استعلام عروض وهمي",
        phone,service:"استكشاف عروض — محاكاة",offer_name:group,amount:null,created_at:new Date().toISOString()});
      return good([{job_uuid:id,status:"claimed",reused:false}]);
    }
    if(name==="station_connect_admin_offer_discovery_job"){
      const id=String(args.p_job_uuid||"");
      const job=state.jobs[id];
      if(!job||!job.service.includes("استكشاف"))return fail("جلسة محاكاة غير موجودة");
      job.status="success";job.result_code="DISCOVERY_COMPLETE";
      state.operations=state.operations.map(o=>o.job_uuid===id?job:o);save(state);
      return good([{job_uuid:id,status:"success",result_code:"DISCOVERY_COMPLETE",family:getDemoGroup(job.phone)}]);
    }
    if(name==="station_connect_admin_offer_route_preview"){
      const offer=demoCatalog.find(o=>o.family===args.p_family&&o.amount===Number(args.p_amount));
      if(!offer?.execution_available)return good([]);
      return good([{route_uuid:"44444444-4444-4444-8444-444444444444",
        sim_uuid:SIM,sim_type:"mobilis-sama",source_label:"Sama محاكاة",
        operational_balance:999999,required_balance:offer.amount+10,priority:1}]);
    }
    if(name==="flexy_mini_admin_create_verified_offer_execute"){
      const phone=String(args.p_phone||"");
      const offer=demoCatalog.find(o=>o.offer_uuid===args.p_offer_uuid);
      if(!offer||!isPhone(phone)||!state.phones[phone]?.at||args.p_station_uuid!==STATION)
        return fail("طلب محاكاة غير مطابق للرقم والعرض");
      if(!offer.execution_available)return fail("العرض غير مؤهل للتنفيذ في لقطة المحاكاة");
      const id=crypto.randomUUID(),status=state.outcome;
      record(state,{job_uuid:id,status,result_code:"SIM_"+status.toUpperCase(),result_text:"نتيجة وهمية — بدون إرسال USSD",
        phone,service:"عرض — محاكاة",offer_name:offer.display_name,amount:offer.amount,created_at:new Date().toISOString()});
      return good([{job_uuid:id,status,reused:false}]);
    }
    if(name==="station_connect_admin_offer_execute_job"){
      const job=state.jobs[String(args.p_job_uuid||"")];
      return job?good([{job_uuid:job.job_uuid,status:job.status,
        result_code:job.result_code,result_text:job.result_text}]):fail("طلب وهمي غير موجود");
    }
    if(name==="flexy_mini_admin_recent_operations"){
      const limit=Math.max(1,Math.min(50,Number(args.p_limit)||10)),offset=Math.max(0,Number(args.p_offset)||0);
      return good(state.operations.slice(offset,offset+limit).map(job=>({
        ...job,total_count:state.operations.length,responses:[{
          sequence:1,action:"simulation",status:job.status,response:job.result_text,created_at:job.created_at,
        }]
      })));
    }
    // IMPORTANT: no unknown RPC can escape the simulator. Fail closed.
    return fail("RPC غير موجود في المحاكاة: "+name);
  }
};
