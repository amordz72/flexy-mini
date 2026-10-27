import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Descriptions,Empty,Grid,Input,Modal,Select,Space,Table,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";
import SamaOperationalActions,{readSamaStatus} from "./SamaOperationalActions";
import ArsselliBalanceActions from "./ArsselliBalanceActions";
import AdminSmsInbox from "./AdminSmsInbox";
import ModemPage from "./ModemPage";
import type {SamaStatus} from "./SamaOperationalActions";

type Station={station_uuid:string;status:string;computer_name:string|null;last_seen_at:string|null;agent_version:string|null};
type Identity={display_code:string|null;custom_label:string|null};
type IdentityRow=Identity&{station_uuid?:string;sim_uuid?:string};
type IdentityResponse={stations:IdentityRow[];sims:IdentityRow[]};
type SimTypeOption={sim_type:string;display_name:string;operator_key:string;enabled:boolean;sort_order:number};
type Hardware={modem_uuid:string;modem_ip:string|null;device_name:string|null;modem_last_seen_at:string|null;sim_uuid:string|null;msisdn:string|null;imsi:string|null;sim_type:string|null;has_pin:boolean;sim_last_seen_at:string|null};
type StationHardware=Hardware&{station_uuid:string};
type UsbModemIdentity={
 modem_uuid:string;station_uuid:string|null;usb_number:number|string|null;
 usb_label:string|null;serial_number:string|null;
};
// USB belongs to the physical modem, never to its current SIM, IP or station display order.
const usbDisplayLabel=(row:UsbModemIdentity|null):string=>{
 const value=String(row?.usb_label??row?.usb_number??"").trim();
 return /^\d+$/.test(value)?"USB "+value.padStart(3,"0"):"USB غير متاح";
};
const serialDisplayTail=(row:UsbModemIdentity|null,all:Record<string,UsbModemIdentity>):string=>{
 const serial=String(row?.serial_number??"").trim();
 if(!serial)return "غير مقروء";
 const others=Object.values(all).filter(item=>item.modem_uuid!==row?.modem_uuid)
  .map(item=>String(item.serial_number??"").trim()).filter(Boolean);
 let digits=Math.min(6,serial.length);
 while(digits<serial.length&&others.some(other=>other.endsWith(serial.slice(-digits))))digits++;
 const tail=serial.slice(-digits);
 return others.some(other=>other.endsWith(tail))?tail+" (متكرر)":tail;
};
type PhoneAttempt={sim_uuid:string;status:string;result_code:string|null;discovered_msisdn:string|null;started_at:string|null};
type PhoneQueue={queued:boolean;state:string;job_uuid:string|null};
type OoredooGuard={sim_uuid:string;is_locked:boolean;cooldown_until:string|null;last_failed_at:string|null;last_attempt_at:string|null;last_failure_code:string|null;admin_armed:boolean};
type OoredooBalanceRead={job_uuid:string;sim_uuid?:string;status:string;result_code?:string|null;raw_response?:string|null;confirmed_balance?:boolean};
const normalizePhone=(raw:string)=>{
 const digits=raw.replace(/\D/g,"");
 return digits.startsWith("213")&&digits.length===12?"0"+digits.slice(3):digits;
};
const operatorOf=(sim:Hardware):"mobilis"|"djezzy"|"ooredoo"|"unknown"=>{
 const imsi=sim.imsi||"";
 if(imsi.startsWith("60301"))return "mobilis";
 if(imsi.startsWith("60302"))return "djezzy";
 if(imsi.startsWith("60303"))return "ooredoo";
 if(sim.sim_type?.startsWith("mobilis-"))return "mobilis";
 if(sim.sim_type?.startsWith("djezzy-"))return "djezzy";
 if(sim.sim_type?.startsWith("ooredoo-"))return "ooredoo";
 return "unknown";
};
const operatorNames:Record<ReturnType<typeof operatorOf>,string>={mobilis:"موبيليس",djezzy:"جيزي",ooredoo:"أوريدو",unknown:"غير معروف"};
const phoneStateLabel=(attempt:PhoneAttempt|undefined)=>{
 if(!attempt)return "لم يُطلب بعد";
 if(attempt.status==="success")return "تم اكتشاف الرقم";
 if(attempt.status==="queued"||attempt.status==="running")return "جاري البحث";
 if(attempt.status==="review")return "تحتاج مراجعة";
 if(attempt.status==="failed")return "فشل الاستعلام";
 return attempt.status||"غير معروف";
};
const online=(date:string|null)=>Boolean(date&&Number.isFinite(Date.parse(date))&&Date.now()-Date.parse(date)>=0&&Date.now()-Date.parse(date)<90000);
// Keep the same priority on desktop Table and mobile Cards. Do not infer connectivity from the saved SIM type.
const stationPriority=(r:Station):number=>{
 if(r.status==="approved"&&online(r.last_seen_at))return 0;
 if(r.status==="approved")return 1;
 if(r.status==="pending")return 2;
 return 3;
};
const stationStatusLabel=(status:string)=>({
 approved:"معتمد",pending:"بانتظار الاعتماد",suspended:"موقوف",revoked:"ملغى"
} as Record<string,string>)[status]||status;
const hardwarePriority=(r:Hardware):number=>{
 const recent=online(r.modem_last_seen_at);
 const known=Boolean(r.sim_uuid&&r.sim_type&&r.sim_type!=="unknown");
 if(recent&&known)return 0;
 if(recent)return 1;
 if(known)return 2;
 return 3;
};
const dateLabel=(value:string|null)=>value?new Date(value).toLocaleString("ar-DZ"):"—";
const cooldownActive=(value:string|null|undefined)=>Boolean(value&&Number.isFinite(Date.parse(value))&&Date.parse(value)>Date.now());
const agentSupportsServiceCode=(version:string|null)=>{
 const match=String(version||"").match(/^([0-9]+)[.]([0-9]+)[.]([0-9]+)/);
 if(!match)return false;
 const [major,minor,patch]=match.slice(1).map(Number);
 return major>0||(minor>4&&major===0)||(major===0&&minor===4&&patch>=11);
};
export default function StationOverview({db}:{db:SupabaseClient}){
 const mobile=!Grid.useBreakpoint().sm;
 const [stations,setStations]=useState<Station[]>([]);
 const [identityNames,setIdentityNames]=useState<{stations:Record<string,Identity>;sims:Record<string,Identity>}>({stations:{},sims:{}});
 const [identityEdit,setIdentityEdit]=useState<{kind:"sim"|"station";uuid:string}|null>(null);
 const [identityDraft,setIdentityDraft]=useState("");
 const [identitySaving,setIdentitySaving]=useState(false);
 const [hardware,setHardware]=useState<Record<string,Hardware[]>>({});
 const [usbIdentities,setUsbIdentities]=useState<Record<string,UsbModemIdentity>>({});
 const [usbDirectoryError,setUsbDirectoryError]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const [simVisibility,setSimVisibility]=useState<"all"|"recent-known"|"recent"|"known">("all");
 const [stationAction,setStationAction]=useState<{uuid:string;nextStatus:"approved"|"pending"}|null>(null);
 const [approvalBusy,setApprovalBusy]=useState(false);
 const [filterStorageKey,setFilterStorageKey]=useState<string|null>(null);
 const [samaRows,setSamaRows]=useState<SamaStatus[]>([]);
 const [samaError,setSamaError]=useState("");
 const [loading,setLoading]=useState(false);
 const [hardwareLoading,setHardwareLoading]=useState(false);
 const [error,setError]=useState("");
 const [checkedAt,setCheckedAt]=useState<string|null>(null);
 const [phoneAttempts,setPhoneAttempts]=useState<Record<string,PhoneAttempt>>({});
 const [phoneBusy,setPhoneBusy]=useState<string|null>(null);
 const [guardMap,setGuardMap]=useState<Record<string,OoredooGuard>>({});
 const [manualNumbers,setManualNumbers]=useState<Record<string,string>>({});
 const [manualBusy,setManualBusy]=useState<string|null>(null);
 const [manualErrors,setManualErrors]=useState<Record<string,string>>({});
 const [rearmBusy,setRearmBusy]=useState<string|null>(null);
 const [ooredooBalanceBusy,setOoredooBalanceBusy]=useState<string|null>(null);
 const [ooredooBalanceReads,setOoredooBalanceReads]=useState<Record<string,OoredooBalanceRead>>({});
 const [pinConfigSim,setPinConfigSim]=useState<string|null>(null);
 const [pinConfigStation,setPinConfigStation]=useState<string|null>(null);
 const [servicePin,setServicePin]=useState("");
 const [pinConfigBusy,setPinConfigBusy]=useState(false);
 const [simTypes,setSimTypes]=useState<SimTypeOption[]>([]);
 const [simTypesLoading,setSimTypesLoading]=useState(false);
 const [draftTypes,setDraftTypes]=useState<Record<string,string>>({});
 const [typeSaving,setTypeSaving]=useState<string|null>(null);
 // Keep the preference separate for each authenticated administrator on this device.
 useEffect(()=>{
  let active=true;
  void db.auth.getUser().then(({data})=>{
   if(active)setFilterStorageKey(data.user?.id?"flexy-mini:station-filter:"+data.user.id:null);
  }).catch(()=>{if(active)setFilterStorageKey(null);});
  return ()=>{active=false;};
 },[db]);
 const loadIdentityNames=useCallback(async()=>{
  const {data,error}=await db.rpc("station_connect_admin_identity_labels");
  if(error){
   // Staged UI remains usable before the independently reviewed DB migration.
   if(error.code!=="PGRST202")setError("تعذر قراءة تسميات الأجهزة: "+error.message);
   return;
  }
  const rows=data as IdentityResponse|null;
  if(!rows||!Array.isArray(rows.stations)||!Array.isArray(rows.sims))return;
  const stations:Record<string,Identity>={},sims:Record<string,Identity>={};
  for(const row of rows.stations)if(row.station_uuid)stations[row.station_uuid]={display_code:row.display_code,custom_label:row.custom_label};
  for(const row of rows.sims)if(row.sim_uuid)sims[row.sim_uuid]={display_code:row.display_code,custom_label:row.custom_label};
  setIdentityNames({stations,sims});
 },[db]);
 const identityCell=(kind:"sim"|"station",uuid:string|null,fallback:string)=>{
  if(!uuid)return <Typography.Text type="secondary">{fallback}</Typography.Text>;
  const identity=kind==="station"?identityNames.stations[uuid]:identityNames.sims[uuid];
  if(!identity)return <Typography.Text strong>{fallback}</Typography.Text>;
  return <Space size={4} align="start">
   <Space direction="vertical" size={0}>
    <Typography.Text strong>{identity?.display_code||fallback}</Typography.Text>
    {identity?.custom_label&&<Typography.Text type="secondary">{identity.custom_label}</Typography.Text>}
   </Space>
   <Button type="link" size="small" onClick={()=>{
    setIdentityDraft(identity?.custom_label||"");setIdentityEdit({kind,uuid});
   }}>تسمية</Button>
  </Space>;
 };
 const saveIdentityName=async()=>{
  if(!identityEdit)return;
  setIdentitySaving(true);
  try{
   const {data,error}=await db.rpc("station_connect_admin_save_identity_label",{
    p_entity:identityEdit.kind,p_uuid:identityEdit.uuid,p_label:identityDraft
   });
   if(error)throw error;
   const saved=data as Identity&{uuid:string}|null;
   if(!saved||saved.uuid!==identityEdit.uuid)throw new Error("لم يؤكد السيرفر الحفظ");
   const key=identityEdit.kind==="station"?"stations":"sims";
   setIdentityNames(previous=>({...previous,[key]:{...previous[key],[saved.uuid]:{
    display_code:saved.display_code,custom_label:saved.custom_label
   }}}));
   setIdentityEdit(null);setIdentityDraft("");
   message.success("تم حفظ التسمية دون تغيير هوية الجهاز");
  }catch(error){message.error("تعذر حفظ التسمية: "+(error instanceof Error?error.message:String(error)));}
  finally{setIdentitySaving(false);}
 };
 const loadSimTypes=useCallback(async()=>{
  setSimTypesLoading(true);
  const {data,error}=await db.rpc("station_connect_admin_sim_types");
  setSimTypesLoading(false);
  if(error){setError("تعذر قراءة أنواع الشرائح: "+error.message);return;}
  if(!Array.isArray(data)){setError("قائمة أنواع الشرائح غير صالحة");return;}
  setSimTypes((data as SimTypeOption[]).filter(type=>type.enabled));
 },[db]);
 const loadOoredooGuards=useCallback(async()=>{
  const {data,error}=await db.rpc("station_connect_admin_ooredoo_lookup_guard");
  if(error){setError("تعذر قراءة حالة حماية أوريدو: "+error.message);return;}
  const next:Record<string,OoredooGuard>={};
  for(const row of (Array.isArray(data)?data:[]) as OoredooGuard[]){
   if(row.sim_uuid)next[row.sim_uuid]=row;
  }
  setGuardMap(next);
 },[db]);
 const loadPhoneAttempts=useCallback(async()=>{
  const {data,error}=await db.rpc("station_connect_admin_sim_phone_discovery_state");
  if(error)return;
  const results:Record<string,PhoneAttempt>={};
  for(const attempt of (Array.isArray(data)?data:[]) as PhoneAttempt[]){
   if(attempt.sim_uuid)results[attempt.sim_uuid]=attempt;
  }
  setPhoneAttempts(results);
 },[db]);
 const loadSamaStatus=useCallback(async()=>{
  try{setSamaRows(await readSamaStatus(db));setSamaError("");}
  catch(e){setSamaError("تعذر قراءة حالة Sama: "+(e instanceof Error?e.message:String(e)));}
 },[db]);
 const loadUsbDirectory=useCallback(async()=>{
  try{
   // Existing read-only, admin-authorized Station Connect RPC. Do not create another numbering system.
   const {data,error}=await db.rpc("station_connect_admin_usb_sim_center");
   if(error||!Array.isArray(data))throw error??new Error("Invalid USB directory");
   const rows:Record<string,UsbModemIdentity>={};
   for(const entry of data as UsbModemIdentity[]){
    if(entry.modem_uuid)rows[entry.modem_uuid]={
     modem_uuid:entry.modem_uuid,station_uuid:entry.station_uuid,
     usb_number:entry.usb_number,usb_label:entry.usb_label,serial_number:entry.serial_number
    };
   }
   setUsbIdentities(rows);setUsbDirectoryError(false);
  }catch{
   // Fail visibly; no made-up USB number from a row index or from IP.
   setUsbIdentities({});setUsbDirectoryError(true);
  }
 },[db]);
 const loadHardwareRows=useCallback(async(targets:Station[])=>{
  if(targets.length===0){setHardware({});setHardwareLoading(false);return;}
  setHardwareLoading(true);
  const results=await Promise.all(targets.map(async station=>{
   try{
    const {data,error}=await db.rpc("station_connect_admin_hardware",{p_station_uuid:station.station_uuid});
    return {uuid:station.station_uuid,rows:data,error};
   }catch(cause){
    return {uuid:station.station_uuid,rows:null,error:{message:cause instanceof Error?cause.message:String(cause)}};
   }
  }));
  const next:Record<string,Hardware[]>={};
  let failures=0;
  for(const result of results){
   if(result.error||!Array.isArray(result.rows)){failures++;continue;}
   next[result.uuid]=result.rows as Hardware[];
  }
  setHardware(previous=>({...previous,...next}));
  setHardwareLoading(false);
  if(failures>0)setError("تعذر تحديث مودمات "+failures+" محطة. حاول مجددًا.");
  setCheckedAt(new Date().toISOString());
 },[db]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  const {data,error}=await db.rpc("flexy_mini_station_overview");
  setLoading(false);
  if(error){setError("تعذر قراءة المحطات: "+error.message);return;}
  if(!Array.isArray(data)){setError("استجابة المحطات غير صالحة");return;}
  const rows=data as Station[];
  setStations(rows);
  setSelected(previous=>previous&&rows.some(station=>station.station_uuid===previous)?previous:null);
  setCheckedAt(new Date().toISOString());
  await Promise.all([loadHardwareRows(rows),loadUsbDirectory()]);
 },[db,loadHardwareRows,loadUsbDirectory]);
 useEffect(()=>{
  void refresh();void loadPhoneAttempts();void loadOoredooGuards();void loadSimTypes();void loadIdentityNames();void loadSamaStatus();
 },[refresh,loadPhoneAttempts,loadOoredooGuards,loadSimTypes,loadIdentityNames,loadSamaStatus]);
 // Both heartbeat and age-based labels must refresh even when nobody clicks "تحديث".
 useEffect(()=>{
  const timer=window.setInterval(()=>{void refresh();void loadSamaStatus();},30000);
  return ()=>window.clearInterval(timer);
 },[refresh,loadSamaStatus]);
 useEffect(()=>{
  if(!filterStorageKey||stations.length===0)return;
  try{
   const stored=window.localStorage.getItem(filterStorageKey);
   const valid=stored&&stations.some(station=>station.station_uuid===stored);
   if(stored&&!valid)window.localStorage.removeItem(filterStorageKey);
   setSelected(valid?stored:null);
  }catch{setSelected(null);}
 },[filterStorageKey,stations]);
 const changeServer=(uuid:string|null)=>{
  setSelected(uuid);
  if(filterStorageKey){
   try{if(uuid)window.localStorage.setItem(filterStorageKey,uuid);else window.localStorage.removeItem(filterStorageKey);}
   catch{/* Storage may be disabled; UI still works for this session. */}
  }
  void loadHardwareRows(uuid?stations.filter(station=>station.station_uuid===uuid):stations);
 };
 const saveManualNumber=async(sim:Hardware)=>{
  if(!sim.sim_uuid||manualBusy)return;
  const uuid=sim.sim_uuid;
  const phone=normalizePhone(manualNumbers[uuid]||"");
  setManualErrors(old=>({...old,[uuid]:""}));
  if(!/^0[5-7]\d{8}$/.test(phone)){
   setManualErrors(old=>({...old,[uuid]:"أدخل رقم هاتف جزائري صحيحًا من 10 أرقام"}));return;
  }
  setManualBusy(uuid);
  try{
   const {data,error}=await db.rpc("station_connect_admin_update_sim",{p_sim_uuid:uuid,p_msisdn:phone});
   if(error)throw error;
   const saved=(Array.isArray(data)?data[0]:data) as {sim_uuid?:string;msisdn?:string}|null;
   if(saved?.sim_uuid!==uuid||saved?.msisdn!==phone)throw new Error("لم يؤكد السيرفر حفظ الرقم؛ أعد تحديث البيانات قبل المحاولة");
   setHardware(old=>Object.fromEntries(Object.entries(old).map(([station,items])=>[station,items.map(item=>item.sim_uuid===uuid?{...item,msisdn:saved.msisdn!}:item)])));
   setManualNumbers(old=>({...old,[uuid]:""}));
   message.success("تم حفظ رقم الشريحة");
  }catch(cause){
   const detail=cause&&typeof cause==="object"&&"message" in cause?String(cause.message):String(cause);
   setManualErrors(old=>({...old,[uuid]:"فشل حفظ الرقم: "+detail}));
  }finally{setManualBusy(null);}
 };
 const rearmOoredoo=async(sim:Hardware)=>{
  if(!sim.sim_uuid)return;
  Modal.confirm({
   title:"السماح بمحاولة أوريدو واحدة",
   content:"لن يتم إرسال أي USSD الآن. ستُفتح موافقة واحدة فقط إن انتهت مهلة الانتظار وكان كود أوريدو مثبتًا وآمنًا. أي فشل سيقفل المحاولة مجددًا 24 ساعة.",
   okText:"طلب السماح",cancelText:"إلغاء",
   onOk:async()=>{
    setRearmBusy(sim.sim_uuid!);
    const {data,error}=await db.rpc("station_connect_admin_rearm_ooredoo_phone_lookup",{p_sim_uuid:sim.sim_uuid});
    setRearmBusy(null);
    if(error){message.error("رفض السيرفر إعادة السماح: "+error.message);return;}
    const row=(Array.isArray(data)?data[0]:data) as {armed:boolean;state:string;cooldown_until:string|null}|undefined;
    if(row?.armed)message.success("تم السماح بمحاولة واحدة. لم يُرسل أي كود بعد.");
    else message.warning(row?.state==="provider_code_unverified"?"كود أوريدو لم يُعتمد بعد؛ ما زالت المحاولات ممنوعة":row?.state==="cooldown_active"?"الانتظار 24 ساعة لم ينتهِ بعد":"لم يُسمح بالمحاولة: "+(row?.state||"غير معروف"));
    await loadOoredooGuards();
   }
  });
 };
 const readOoredooBalance=async(sim:Hardware)=>{
  if(!sim.sim_uuid||ooredooBalanceBusy)return;
  const uuid=sim.sim_uuid;
  if(!sim.sim_type?.startsWith("ooredoo-")||!sim.has_pin){
   message.warning("يلزم نوع شريحة أوريدو وPIN خدمة مسجل.");return;
  }
  setOoredooBalanceBusy(uuid);
  try{
   const {data,error}=await db.rpc("station_connect_admin_queue_ooredoo_pin_balance",{p_sim_uuid:uuid});
   if(error)throw error;
   const row=(Array.isArray(data)?data[0]:data) as {job_uuid?:string;status?:string}|undefined;
   if(!row?.job_uuid)throw new Error("السيرفر لم يؤكد إنشاء طلب الاستعلام");
   setOoredooBalanceReads(prev=>({...prev,[uuid]:{job_uuid:row.job_uuid!,status:row.status||"claimed"}}));
   message.info("طُلب كشف رصيد أوريدو. هذه ليست عملية فليكسي.");
   for(let i=0;i<12;i++){
    await new Promise(resolve=>setTimeout(resolve,1000));
    const {data:response,error:pollError}=await db.rpc("station_connect_admin_ooredoo_pin_balance_job",{p_job_uuid:row.job_uuid});
    if(pollError)throw pollError;
    const result=(Array.isArray(response)?response[0]:response) as OoredooBalanceRead|null;
    if(!result||result.job_uuid!==row.job_uuid||result.sim_uuid!==uuid)throw new Error("تعذر تأكيد هوية نتيجة أوريدو");
    setOoredooBalanceReads(prev=>({...prev,[uuid]:result}));
    if(["success","failed","review","unavailable"].includes(result.status))return;
   }
   message.warning("تأخر رد الاستعلام؛ لا يُعاد إرساله تلقائيًا.");
  }catch(cause){
   message.error("تعذر قراءة رصيد أوريدو: "+(cause instanceof Error?cause.message:String(cause)));
  }finally{setOoredooBalanceBusy(null);}
 };
 const discoverPhone=async(sim:Hardware,stationUuid:string)=>{
  if(!sim.sim_uuid||sim.msisdn)return;
  const operator=operatorOf(sim);
  if(operator==="unknown"){message.warning("المتعامل غير معروف؛ يجب اكتشاف IMSI أولًا. لن نرسل كودًا عشوائيًا.");return;}
  if(operator==="ooredoo"){message.info("كود *200*PIN# خاص بمعرفة رصيد أوريدو، وليس معرفة رقم الهاتف.");return;}
  const agent=stations.find(station=>station.station_uuid===stationUuid);
  if(operator==="djezzy"&&!agentSupportsServiceCode(agent?.agent_version||null)){
   message.warning("جيزي 99 تحتاج Station Agent 0.4.11 أو أحدث. النسخة الحالية: "+(agent?.agent_version||"غير معروفة"));return;
  }
  setPhoneBusy(sim.sim_uuid);
  try{
   const {data,error}=await db.rpc("station_connect_admin_retry_sim_phone_discovery",{p_sim_uuid:sim.sim_uuid});
   if(error){message.error("تعذر طلب رقم الشريحة: "+error.message);return;}
   const response=(Array.isArray(data)?data[0]:data) as PhoneQueue|undefined;
   if(response?.queued)message.success("تم إرسال طلب معرفة الرقم حسب المتعامل إلى Station Connect");
   else message.info("لم يُرسل الأمر: "+(response?.state||"الاستعلام غير متاح"));
   await loadPhoneAttempts();
  }catch{message.error("تعذر الاتصال بخدمة اكتشاف رقم الشريحة");}
  finally{setPhoneBusy(null);}
 };
 const saveServicePin=async()=>{
  if(!pinConfigSim||!pinConfigStation)return;
  if(!/^[0-9]{4,8}$/.test(servicePin)){message.warning("أدخل PIN الخدمة من 4 إلى 8 أرقام");return;}
  const sim=(hardware[pinConfigStation]||[]).find(item=>item.sim_uuid===pinConfigSim);
  if(!sim?.sim_uuid){message.error("الشريحة غير موجودة، حدّث بيانات المحطة");return;}
  setPinConfigBusy(true);
  try{
   const {data,error}=await db.rpc("station_connect_admin_update_sim",{
    p_sim_uuid:sim.sim_uuid,p_service_pin:servicePin
   });
   if(error)throw error;
   const updated=(Array.isArray(data)?data[0]:data) as {has_pin?:boolean}|null;
   if(updated?.has_pin!==true)throw new Error("لم يؤكد السيرفر حفظ PIN");
   setHardware(old=>Object.fromEntries(Object.entries(old).map(([station,items])=>[
    station,items.map(item=>item.sim_uuid===pinConfigSim?{...item,has_pin:true}:item)
   ])));
   setPinConfigSim(null);setPinConfigStation(null);setServicePin("");
   message.success("تم حفظ PIN للشريحة دون تغيير نوعها أو اعتمادها");
  }catch(cause){
   message.error("تعذر حفظ PIN: "+(cause instanceof Error?cause.message:String(cause)));
  }finally{setPinConfigBusy(false);}
 };
 const saveSimType=async(sim:Hardware)=>{
  if(!sim.sim_uuid)return;
  const chosen=draftTypes[sim.sim_uuid];
  if(!chosen||chosen===sim.sim_type)return;
  setTypeSaving(sim.sim_uuid);
  try{
   const {data,error}=await db.rpc("station_connect_admin_update_sim",{
    p_sim_uuid:sim.sim_uuid,p_sim_type:chosen
   });
   if(error)throw error;
   const updated=(Array.isArray(data)?data[0]:data) as {sim_type?:string}|null;
   if(updated?.sim_type!==chosen)throw new Error("لم يؤكد السيرفر حفظ النوع المختار");
   setHardware(old=>Object.fromEntries(Object.entries(old).map(([station,items])=>[
    station,items.map(item=>item.sim_uuid===sim.sim_uuid?{...item,sim_type:chosen}:item)
   ])));
   setDraftTypes(old=>{const next={...old};delete next[sim.sim_uuid!];return next;});
   message.success("تم حفظ نوع الشريحة");
  }catch(cause){
   message.error("تعذر حفظ نوع الشريحة: "+(cause instanceof Error?cause.message:String(cause)));
  }finally{setTypeSaving(null);}
 };
 const typeAction=(sim:Hardware)=>{
  if(!sim.sim_uuid)return <Typography.Text type="secondary">الشريحة غير محددة</Typography.Text>;
  const operator=operatorOf(sim);
  const available=simTypes.filter(type=>type.operator_key===operator&&
   (operator==="mobilis"||!type.sim_type.endsWith("-gros")));
  const chosen=draftTypes[sim.sim_uuid]??(sim.sim_type!=="unknown"?sim.sim_type:undefined);
  const dirty=Boolean(draftTypes[sim.sim_uuid]&&draftTypes[sim.sim_uuid]!==sim.sim_type);
  // A familiar number prefix may suggest an option, but it cannot prove a SIM service type.
  const suggestArsselli=operator==="mobilis"&&normalizePhone(sim.msisdn||"").startsWith("0660")
   &&sim.sim_type!=="mobilis-arsselli";

  return <Space direction="vertical" size={4}>
   <Space.Compact>
    <Select
     aria-label="نوع الشريحة"
     size="small"
     placeholder="اختر النوع"
     loading={simTypesLoading}
     disabled={simTypesLoading||operator==="unknown"||available.length===0||typeSaving===sim.sim_uuid}
     value={chosen}
     options={available.map(type=>({value:type.sim_type,label:type.display_name}))}
     onChange={value=>setDraftTypes(old=>({...old,[sim.sim_uuid!]:value}))}
     style={{minWidth:145}}
    />
    <Button size="small" type={dirty?"primary":"default"} disabled={!dirty||typeSaving!==null} loading={typeSaving===sim.sim_uuid} onClick={()=>void saveSimType(sim)}>حفظ</Button>
   </Space.Compact>
   {suggestArsselli&&<Space wrap size={4}>
    <Typography.Text type="secondary">اقتراح: أرسالي (بادئة 0660، يحتاج تأكيدًا)</Typography.Text>
    <Button size="small" disabled={typeSaving!==null}
     onClick={()=>setDraftTypes(old=>({...old,[sim.sim_uuid!]: "mobilis-arsselli"}))}>اختيار أرسالي</Button>
   </Space>}
  </Space>;
 };
 const pinAction=(sim:Hardware,stationUuid:string)=><Space direction="vertical" size={4}>
  <Tag>{sim.has_pin?"مسجل بأمان":"غير مسجل"}</Tag>
  {sim.sim_uuid&&<Button size="small" disabled={pinConfigBusy}
   onClick={()=>{setServicePin("");setPinConfigStation(stationUuid);setPinConfigSim(sim.sim_uuid);}}>
    {sim.has_pin?"تغيير PIN":"تسجيل PIN"}
   </Button>}
  {sim.sim_uuid&&operatorOf(sim)==="ooredoo"&&<>
   <Button size="small" loading={ooredooBalanceBusy===sim.sim_uuid}
    disabled={!sim.has_pin||!online(sim.sim_last_seen_at)||!online(sim.modem_last_seen_at)||ooredooBalanceBusy!==null}
    onClick={()=>void readOoredooBalance(sim)}>معرفة رصيد أوريدو (*200*PIN#)</Button>
   {ooredooBalanceReads[sim.sim_uuid]&&<Typography.Text type="secondary" style={{fontSize:11}}>
    {ooredooBalanceReads[sim.sim_uuid].status==="claimed"?"تنفيذ استعلام الرصيد":
     ooredooBalanceReads[sim.sim_uuid].status==="review"?"الرد يحتاج مراجعة/تفسير رصيد":
     ooredooBalanceReads[sim.sim_uuid].status==="failed"?"فشل تنفيذ استعلام الرصيد":
     ooredooBalanceReads[sim.sim_uuid].status}
    {ooredooBalanceReads[sim.sim_uuid].result_code?" — "+ooredooBalanceReads[sim.sim_uuid].result_code:""}
   </Typography.Text>}
   {ooredooBalanceReads[sim.sim_uuid]?.raw_response&&
    <Typography.Text copyable style={{maxWidth:260,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>
     {ooredooBalanceReads[sim.sim_uuid].raw_response}
    </Typography.Text>}
  </>}
 </Space>;
 const phoneAction=(sim:Hardware,stationUuid:string)=>{
  if(!sim.sim_uuid)return <Typography.Text type="secondary">الشريحة غير محددة</Typography.Text>;
  const attempt=phoneAttempts[sim.sim_uuid];
  const state=phoneStateLabel(attempt);
  if(sim.msisdn)return <Tag color="green">الرقم معروف</Tag>;
  const operator=operatorOf(sim);
  return <Space direction="vertical" size={4}>
   <Tag color={attempt?.status==="success"?"green":attempt?.status==="running"?"blue":"orange"}>{state}</Tag>
   {attempt?.result_code&&<Typography.Text type="secondary" style={{fontSize:11}}>{attempt.result_code}</Typography.Text>}
   <Button size="small" loading={phoneBusy===sim.sim_uuid} disabled={hardwareLoading||operator==="unknown"||operator==="ooredoo"||(operator==="djezzy"&&!agentSupportsServiceCode(stations.find(station=>station.station_uuid===stationUuid)?.agent_version||null))} onClick={()=>void discoverPhone(sim,stationUuid)}>معرفة الرقم تلقائيًا</Button>
   {operator==="ooredoo"&&<Typography.Text type="secondary" style={{fontSize:11}}>{guardMap[sim.sim_uuid]?.last_failed_at?"آخر فشل: "+dateLabel(guardMap[sim.sim_uuid].last_failed_at):"لا توجد محاولة موثقة"} — {cooldownActive(guardMap[sim.sim_uuid]?.cooldown_until)?"محظور حتى "+dateLabel(guardMap[sim.sim_uuid].cooldown_until):"المحاولات محمية ومقفلة افتراضيًا"}</Typography.Text>}
   {operator==="ooredoo"&&guardMap[sim.sim_uuid]?.last_failure_code&&<Typography.Text type="secondary" style={{fontSize:11}}>سبب الفشل: {guardMap[sim.sim_uuid].last_failure_code}</Typography.Text>}
   {operator==="ooredoo"&&<Button size="small" loading={rearmBusy===sim.sim_uuid} disabled={!!(cooldownActive(guardMap[sim.sim_uuid]?.cooldown_until))} onClick={()=>void rearmOoredoo(sim)}>إعادة السماح من الإدارة</Button>}
   {operator==="ooredoo"&&<Typography.Text type="secondary" style={{fontSize:11}}>كود *200*PIN# مؤكد لمعرفة الرصيد فقط؛ معرفة رقم الهاتف خدمة مستقلة</Typography.Text>}
   {operator==="djezzy"&&!agentSupportsServiceCode(stations.find(station=>station.station_uuid===stationUuid)?.agent_version||null)&&<Typography.Text type="secondary" style={{fontSize:11}}>جيزي 99 تحتاج Agent 0.4.11+</Typography.Text>}
   <Space.Compact style={{width:"100%"}}>
    <Input aria-label="رقم الشريحة يدويًا" dir="ltr" inputMode="tel" placeholder="0XXXXXXXXX" value={manualNumbers[sim.sim_uuid]||""} maxLength={20} onChange={event=>setManualNumbers(old=>({...old,[sim.sim_uuid!]:event.target.value}))}/>
    <Button loading={manualBusy===sim.sim_uuid} disabled={manualBusy!==null} onClick={()=>void saveManualNumber(sim)}>حفظ يدوي</Button>
   </Space.Compact>
   {manualErrors[sim.sim_uuid]&&<Alert type="error" showIcon message={manualErrors[sim.sim_uuid]}/>}
  </Space>;
 };
 const serverName=(uuid:string)=>{
  const station=stations.find(item=>item.station_uuid===uuid);
  const identity=identityNames.stations[uuid];
  const code=identity?.display_code||station?.computer_name||"محطة دون اسم";
  return identity?.custom_label?code+" — "+identity.custom_label:code;
 };
 const visibleStations=selected?stations.filter(station=>station.station_uuid===selected):stations;
 const usbForModem=(r:StationHardware):UsbModemIdentity|null=>{
  const found=usbIdentities[r.modem_uuid];
  // Only show an identity when the RPC agrees about its current owning station.
  return found?.station_uuid===r.station_uuid?found:null;
 };
 const modemTitle=(r:StationHardware)=><Space direction="vertical" size={0}>
  <Typography.Text strong>{usbDisplayLabel(usbForModem(r))}</Typography.Text>
  <Typography.Text type="secondary" style={{fontSize:12}}>
   <span dir="ltr">Serial: {serialDisplayTail(usbForModem(r),usbIdentities)}</span>
  </Typography.Text>
 </Space>;
 const simStatus=(row:StationHardware)=>samaRows.find(sim=>
  sim.sim_uuid===row.sim_uuid&&sim.station_uuid===row.station_uuid&&sim.sim_type==="mobilis-sama");
 const balanceLabel=(row:StationHardware)=>{
  const sim=simStatus(row);
  if(!sim)return "—";
  if(!sim.balance_initialized)return "لم يُقرأ بعد";
  return sim.operational_balance===null?"غير معروف":Number(sim.operational_balance).toLocaleString("en-US")+" دج";
 };
 const simActions=(row:StationHardware)=>{
  if(!row.sim_uuid)return <Empty description="لا توجد شريحة في هذا المودم"/>;
  const sama=simStatus(row);
  return <Space direction="vertical" size="small" style={{width:"100%"}}>
   <Descriptions size="small" bordered column={1} items={[
    {key:"type",label:"تحديد النوع",children:typeAction(row)},
    {key:"pin",label:"PIN الخدمة",children:pinAction(row,row.station_uuid)},
    {key:"lookup",label:"معرفة الرقم",children:phoneAction(row,row.station_uuid)},
    {key:"seen",label:"آخر ظهور",children:dateLabel(row.sim_last_seen_at||row.modem_last_seen_at)}
   ]}/>
   {sama&&<SamaOperationalActions db={db} sim={sama} onRefresh={loadSamaStatus}/>}
   {row.sim_type==="mobilis-arsselli"&&<ArsselliBalanceActions db={db} simUuid={row.sim_uuid}
    canRequestBalance={Boolean(row.has_pin&&online(row.modem_last_seen_at)&&online(row.sim_last_seen_at)
     &&stations.some(st=>st.station_uuid===row.station_uuid&&st.status==="approved"&&online(st.last_seen_at)))}/>}
   {/* The admin phone (agent_version "phone-*") has no HiLink modem and no SMS reader: modem_status and sms_read are rejected there. */}
   {(stations.find(st=>st.station_uuid===row.station_uuid)?.agent_version||"").startsWith("phone-")
    ?<Alert type="info" showIcon message="هاتف الإدارة: لا صفحة مودم ولا قارئ رسائل في التطبيق"/>
    :<>
     <ModemPage db={db} simUuid={row.sim_uuid} agentVersion={stations.find(st=>st.station_uuid===row.station_uuid)?.agent_version||null}/>
     <AdminSmsInbox db={db} simUuid={row.sim_uuid}/>
    </>}
   {row.sim_type==="mobilis-sama"&&!sama&&
    <Alert type="warning" message="بيانات جاهزية Sama غير متاحة لهذه الشريحة، حدّث الحالة" showIcon/>}
  </Space>;
 };
 const shortSim=(r:StationHardware)=><>
  {identityCell("sim",r.sim_uuid,r.sim_uuid?"شريحة مسجلة":"بدون شريحة")}
 </>;
 const confirmStationStatusChange=async()=>{
  if(!stationAction||approvalBusy)return;
  const station=stations.find(item=>item.station_uuid===stationAction.uuid);
  const expectedStatus=stationAction.nextStatus==="approved"?"pending":"approved";
  if(!station||station.status!==expectedStatus){
   message.warning("حالة المحطة تغيّرت؛ حدّث القائمة قبل المحاولة");
   setStationAction(null);
   return;
  }
  setApprovalBusy(true);
  try{
   // The existing admin-only RPC changes approval status, never deletes a station or SIM.
   const {data,error}=await db.rpc("station_connect_admin_set_status",{
    p_station_uuid:station.station_uuid,p_status:stationAction.nextStatus
   });
   if(error)throw error;
   const result=(Array.isArray(data)?data[0]:data) as {station_uuid?:string;status?:string}|null;
   if(result?.station_uuid!==station.station_uuid||result.status!==stationAction.nextStatus)
    throw new Error("السيرفر لم يؤكد تغيير حالة هذه المحطة");
   const removed=stationAction.nextStatus==="pending";
   setStationAction(null);
   message.success(removed?"تم إلغاء الاعتماد؛ المحطة بانتظار اعتماد جديد":"تم اعتماد المحطة؛ ننتظر اتصال Agent لتظهر متصلة");
   await refresh();
  }catch(error){
   message.error("تعذر تغيير اعتماد المحطة: "+(error instanceof Error?error.message:String(error)));
  }finally{
   setApprovalBusy(false);
  }
 };
 const simSummary=(r:StationHardware)=><Descriptions size="small" bordered column={1} items={[
  {key:"sim",label:"الشريحة",children:shortSim(r)},
  {key:"phone",label:"رقم الشريحة",children:<span dir="ltr">{r.msisdn||"غير معروف"}</span>},
  {key:"type",label:"النوع",children:r.sim_type||"غير محدد"},
  ...(r.sim_type==="mobilis-sama"?[
   {key:"balance",label:"رصيد Sama المسجل",children:balanceLabel(r)}
  ]:[])
 ]}/>;
 const modemTechnicalDetails=(r:StationHardware)=><Descriptions size="small" bordered column={1} items={[
  {key:"model",label:"موديل المودام",children:r.device_name||"غير معروف"},
  {key:"ip",label:"IP محلي",children:<span dir="ltr">{r.modem_ip||"—"}</span>},
  {key:"operator",label:"المتعامل",children:operatorNames[operatorOf(r)]},
  {key:"pin",label:"PIN",children:r.has_pin?"محفوظ بأمان":"غير محفوظ"},
  ...(r.sim_type==="mobilis-sama"?[
   {key:"ready",label:"استكشاف Sama",children:simStatus(r)?.discover_ready?<Tag color="green">جاهزة للاستكشاف</Tag>:<Tag color="orange">تحتاج تجهيزًا</Tag>}
  ]:[])
 ]}/>;
 const stationRows=[...stations].sort((a,b)=>stationPriority(a)-stationPriority(b)
  ||(identityNames.stations[a.station_uuid]?.display_code||a.computer_name||"").localeCompare(
    identityNames.stations[b.station_uuid]?.display_code||b.computer_name||""));
 const allModems=visibleStations.flatMap(station=>(hardware[station.station_uuid]||[])
  .map(r=>({...r,station_uuid:station.station_uuid})));
 const modems=allModems.filter(r=>simVisibility==="all"||
  (simVisibility==="recent-known"&&hardwarePriority(r)===0)||
  (simVisibility==="recent"&&online(r.modem_last_seen_at))||
  (simVisibility==="known"&&Boolean(r.sim_uuid&&r.sim_type&&r.sim_type!=="unknown"))
 ).sort((a,b)=>hardwarePriority(a)-hardwarePriority(b));
 return <Space direction="vertical" size="middle" style={{width:"100%"}}>
  <Card size="small" title="الكمبيوترات">
   <Table<Station>
    aria-label="جدول المحطات"
    rowKey={station=>station.station_uuid}
    dataSource={stationRows}
    size="small"
    pagination={false}
    scroll={{x:mobile?610:760}}
    columns={[
     {title:"المحطة",render:(_,station)=>identityCell("station",station.station_uuid,station.computer_name||"محطة دون اسم")},
     {title:"الاعتماد",render:(_,station)=><Tag color={station.status==="approved"?"green":station.status==="pending"?"orange":"default"}>{stationStatusLabel(station.status)}</Tag>},
     {title:"الاتصال",render:(_,station)=><Space direction="vertical" size={0}>
      <Tag color={station.status==="approved"&&online(station.last_seen_at)?"green":"default"}>
       {station.status==="approved"&&online(station.last_seen_at)?"نبض حديث ≤90ث":"لا يوجد نبض حديث"}
      </Tag>
      <Typography.Text type="secondary">{dateLabel(station.last_seen_at)}</Typography.Text>
     </Space>},
     ...(!mobile?[{title:"Agent",render:(_:unknown,station:Station)=>station.agent_version||"—"}]:[]),
     {title:"الإجراء",render:(_,station)=>station.status==="pending"?
      <Button size="small" type="primary" disabled={approvalBusy}
       onClick={()=>setStationAction({uuid:station.station_uuid,nextStatus:"approved"})}>اعتماد</Button>:
      station.status==="approved"?
      <Button size="small" danger disabled={approvalBusy}
       onClick={()=>setStationAction({uuid:station.station_uuid,nextStatus:"pending"})}>إلغاء الاعتماد</Button>:
      <Typography.Text type="secondary">—</Typography.Text>}
    ]}
   />
  </Card>
  <Card size="small" title="فلترة المودمات والشرائح">
   <Space direction="vertical" size="small" style={{width:"100%"}}>
    <Space style={{width:"100%",justifyContent:"space-between"}}>
     <Typography.Text strong>فلترة حسب السيرفر</Typography.Text>
     <Button size="small" loading={loading||hardwareLoading} onClick={()=>{void refresh();void loadSamaStatus();}}>تحديث</Button>
    </Space>
    <Select aria-label="فلترة حسب السيرفر" value={selected??"all"} style={{width:"100%",maxWidth:380}}
     options={[{value:"all",label:"كل السيرفرات"},...stations.map(station=>({value:station.station_uuid,label:serverName(station.station_uuid)}))]}
     onChange={value=>changeServer(value==="all"?null:value)}/>
    <Typography.Text type="secondary">اختيار السيرفر محفوظ لهذا الحساب على هذا الجهاز. جدول المحطات أعلاه يظهر جميع الكمبيوترات دائمًا.</Typography.Text>
    <Select aria-label="فلترة حالة الشرائح" value={simVisibility} style={{width:"100%",maxWidth:380}}
     options={[{value:"all",label:"جميع المودمات والشرائح (المتصلة أولًا)"},{value:"recent-known",label:"المعروفة والمرصودة حديثًا فقط"},{value:"recent",label:"الأجهزة المرصودة حديثًا فقط"},{value:"known",label:"جميع الشرائح المعروفة"}]}
     onChange={setSimVisibility}/>
   </Space>
  </Card>
  {error&&<Alert type="error" showIcon message={error}/>}
  {samaError&&<Alert type="warning" showIcon message={samaError}/>}
  {usbDirectoryError&&<Alert type="warning" showIcon message="تعذر قراءة رقم USB والسيريال من Station Connect؛ لم يتم تعيين أرقام بديلة."/>}
  {checkedAt&&<Typography.Text type="secondary">آخر تحديث: {dateLabel(checkedAt)}</Typography.Text>}
  <Card size="small" title={`المودمات والشرائح (${modems.length} من ${allModems.length})`}>
   {hardwareLoading&&<Typography.Text type="secondary">جاري تحديث المودمات...</Typography.Text>}
   {!hardwareLoading&&modems.length===0&&<Empty description="لا توجد مودمات تطابق الفلتر المحدد"/>}
   <Table<StationHardware>
    aria-label="جدول المودمات والشرائح"
    rowKey={r=>r.modem_uuid+":"+(r.sim_uuid||"none")}
    dataSource={modems}
    size="small"
    scroll={{x:mobile?650:1050}}
    pagination={{pageSize:10}}
    columns={[
     {title:"السيرفر",render:(_,r)=>serverName(r.station_uuid)},
     {title:"المودم",render:(_,r)=>modemTitle(r)},
     {title:"الشريحة",render:(_,r)=>shortSim(r)},
     ...(!mobile?[
      {title:"رقم الشريحة",render:(_:unknown,r:StationHardware)=><span dir="ltr">{r.msisdn||"غير معروف"}</span>},
      {title:"النوع",render:(_:unknown,r:StationHardware)=>r.sim_type||"—"},
      {title:"PIN",render:(_:unknown,r:StationHardware)=>r.has_pin?"محفوظ":"غير محفوظ"},
      {title:"رصيد Sama المسجل",render:(_:unknown,r:StationHardware)=>balanceLabel(r)}
     ]:[]),
     {title:"الاتصال",render:(_,r)=><Tag color={online(r.modem_last_seen_at)?"green":"default"}>
      {online(r.modem_last_seen_at)?"مرصود خلال 90ث":"لا يوجد رصد حديث"}
     </Tag>}
    ]}
    expandable={{rowExpandable:()=>true,expandedRowRender:r=><Space direction="vertical" size="small" style={{width:"100%"}}>
     {simSummary(r)}
     {modemTechnicalDetails(r)}
     {r.sim_uuid&&simActions(r)}
    </Space>}}
   />
  </Card>
  <Modal
   title={stationAction?.nextStatus==="pending"?"إلغاء اعتماد المحطة":"اعتماد المحطة"}
   open={Boolean(stationAction)}
   onCancel={()=>{if(!approvalBusy)setStationAction(null);}}
   onOk={()=>void confirmStationStatusChange()}
   okText={stationAction?.nextStatus==="pending"?"نعم، إلغاء الاعتماد":"اعتماد المحطة"}
   okButtonProps={{danger:stationAction?.nextStatus==="pending"}}
   cancelText="رجوع"
   confirmLoading={approvalBusy}
   closable={!approvalBusy}
   maskClosable={!approvalBusy}>
   <Typography.Text>
    {stationAction?.nextStatus==="pending"?
     <>هل تريد إلغاء اعتماد {serverName(stationAction.uuid)}؟ ستتوقف المحطة عن استقبال الأوامر وإرسال نبض الاتصال حتى تعيد اعتمادها. تبقى هوية الكمبيوتر والمودمات والشرائح محفوظة.</>:
     <>هل تريد اعتماد {stationAction?serverName(stationAction.uuid):"هذه المحطة"}؟ لن تتغير حالة أي محطة أخرى، والاتصال يحتاج نبض Agent.</>}
   </Typography.Text>
  </Modal>
  <Modal title="التسمية الخاصة" open={Boolean(identityEdit)}
   onCancel={()=>{if(!identitySaving){setIdentityEdit(null);setIdentityDraft("");}}}
   onOk={()=>void saveIdentityName()} okText="حفظ" cancelText="إلغاء"
   confirmLoading={identitySaving} maskClosable={!identitySaving}>
   <Space direction="vertical" style={{width:"100%"}}>
    <Typography.Text type="secondary">المعرّف التلقائي ثابت، والتسمية اختيارية ويمكن تركها فارغة.</Typography.Text>
    <Input aria-label="الاسم الخاص" placeholder="مثال: عمر سما1 أو PC bach" maxLength={80}
     value={identityDraft} onChange={event=>setIdentityDraft(event.target.value)}
     onPressEnter={()=>{if(!identitySaving)void saveIdentityName();}}/>
   </Space>
  </Modal>
  <Modal
   title="PIN خدمة الشريحة"
   open={Boolean(pinConfigSim)}
   onCancel={()=>{if(!pinConfigBusy){setPinConfigSim(null);setPinConfigStation(null);setServicePin("");}}}
   onOk={()=>void saveServicePin()}
   okText="حفظ PIN"
   okButtonProps={{disabled:!/^[0-9]{4,8}$/.test(servicePin)}}
   confirmLoading={pinConfigBusy}
   cancelText="إلغاء"
   maskClosable={!pinConfigBusy}
   closable={!pinConfigBusy}
  >
   <Space direction="vertical" size="middle" style={{width:"100%"}}>
    <Typography.Text>الشريحة: <span dir="ltr">{(hardware[pinConfigStation||""]||[]).find(item=>item.sim_uuid===pinConfigSim)?.msisdn||"غير معروف"}</span></Typography.Text>
    <Input.Password
     aria-label="PIN خدمة الشريحة" inputMode="numeric" autoComplete="new-password" maxLength={8}
     value={servicePin} onChange={event=>setServicePin(event.target.value.replace(/\D/g,""))}
     placeholder="PIN الخدمة"
    />
    <Typography.Text type="secondary">حفظ PIN لا يغيّر نوع الشريحة ولا يعتمدها للفليكسي.</Typography.Text>
   </Space>
  </Modal>
 </Space>;
}
