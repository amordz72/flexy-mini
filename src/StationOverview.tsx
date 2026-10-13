import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Descriptions,Empty,Grid,Input,Modal,Select,Space,Table,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";
import SamaOperationalActions from "./SamaOperationalActions";

type Station={station_uuid:string;status:string;computer_name:string|null;last_seen_at:string|null;agent_version:string|null};
type Identity={display_code:string|null;custom_label:string|null};
type IdentityRow=Identity&{station_uuid?:string;sim_uuid?:string};
type IdentityResponse={stations:IdentityRow[];sims:IdentityRow[]};
type SimTypeOption={sim_type:string;display_name:string;operator_key:string;enabled:boolean;sort_order:number};
type Hardware={modem_uuid:string;modem_ip:string|null;device_name:string|null;modem_last_seen_at:string|null;sim_uuid:string|null;msisdn:string|null;imsi:string|null;sim_type:string|null;has_pin:boolean;sim_last_seen_at:string|null};
type PhoneAttempt={sim_uuid:string;status:string;result_code:string|null;discovered_msisdn:string|null;started_at:string|null};
type PhoneQueue={queued:boolean;state:string;job_uuid:string|null};
type OoredooGuard={sim_uuid:string;is_locked:boolean;cooldown_until:string|null;last_failed_at:string|null;last_attempt_at:string|null;last_failure_code:string|null;admin_armed:boolean};
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
const online=(date:string|null)=>Boolean(date&&Date.now()-new Date(date).getTime()<90000);
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
 const [selected,setSelected]=useState<string|null>(null);
 const [loading,setLoading]=useState(false);
 const [hardwareLoading,setHardwareLoading]=useState(false);
 const [error,setError]=useState("");
 const [checkedAt,setCheckedAt]=useState<string|null>(null);
 const [phoneAttempts,setPhoneAttempts]=useState<Record<string,PhoneAttempt>>({});
 const [phoneBusy,setPhoneBusy]=useState<string|null>(null);
 const [guardMap,setGuardMap]=useState<Record<string,OoredooGuard>>({});
 const [manualNumbers,setManualNumbers]=useState<Record<string,string>>({});
 const [manualBusy,setManualBusy]=useState<string|null>(null);
 const [rearmBusy,setRearmBusy]=useState<string|null>(null);
 const [pinConfigSim,setPinConfigSim]=useState<string|null>(null);
 const [servicePin,setServicePin]=useState("");
 const [pinConfigBusy,setPinConfigBusy]=useState(false);
 const [simTypes,setSimTypes]=useState<SimTypeOption[]>([]);
 const [simTypesLoading,setSimTypesLoading]=useState(false);
 const [draftTypes,setDraftTypes]=useState<Record<string,string>>({});
 const [typeSaving,setTypeSaving]=useState<string|null>(null);
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
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  const {data,error}=await db.rpc("flexy_mini_station_overview");
  setLoading(false);
  if(error){setError("تعذر قراءة المحطات: "+error.message);return;}
  if(!Array.isArray(data)){setError("استجابة المحطات غير صالحة");return;}
  setStations(data as Station[]);setCheckedAt(new Date().toISOString());
 },[db]);
 useEffect(()=>{void refresh();void loadPhoneAttempts();void loadOoredooGuards();void loadSimTypes();void loadIdentityNames();},[refresh,loadPhoneAttempts,loadOoredooGuards,loadSimTypes,loadIdentityNames]);
 const saveManualNumber=async(sim:Hardware)=>{
  if(!sim.sim_uuid)return;
  const phone=normalizePhone(manualNumbers[sim.sim_uuid]||"");
  if(!/^0[5-7]\d{8}$/.test(phone)){message.warning("أدخل رقم هاتف جزائري صحيحًا من 10 أرقام");return;}
  Modal.confirm({
   title:"تسجيل رقم الشريحة يدويًا",
   content:"سيُسجّل الرقم "+phone+" لهذه الشريحة في قاعدة البيانات، دون أي استعلام أو محاولة اتصال بالشبكة. هل تؤكد؟",
   okText:"تسجيل الرقم",cancelText:"إلغاء",
   onOk:async()=>{
    setManualBusy(sim.sim_uuid!);
    try{
     const {error}=await db.rpc("station_connect_admin_update_sim",{p_sim_uuid:sim.sim_uuid,p_msisdn:phone});
     if(error)throw error;
     setHardware(old=>Object.fromEntries(Object.entries(old).map(([station,items])=>[station,items.map(item=>item.sim_uuid===sim.sim_uuid?{...item,msisdn:phone}:item)])));
     setManualNumbers(old=>({...old,[sim.sim_uuid!]:""}));
     message.success("تم تسجيل الرقم يدويًا دون إرسال USSD");
    }catch(error){message.error("فشل حفظ الرقم: "+(error instanceof Error?error.message:String(error)));}
    finally{setManualBusy(null);}
   }
  });
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
 const discoverPhone=async(sim:Hardware)=>{
  if(!sim.sim_uuid||sim.msisdn)return;
  const operator=operatorOf(sim);
  if(operator==="unknown"){message.warning("المتعامل غير معروف؛ يجب اكتشاف IMSI أولًا. لن نرسل كودًا عشوائيًا.");return;}
  if(operator==="ooredoo"){message.warning("أوريدو: صيغة *200*PIN# مسجلة للمراجعة، لكنها قد تنفذ شحنًا إذا كان PIN كود بطاقة. لن نرسلها قبل تأكيد نوع PIN.");return;}
  const agent=stations.find(station=>station.station_uuid===selected);
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
  if(!pinConfigSim||!selected)return;
  if(!/^[0-9]{4,8}$/.test(servicePin)){message.warning("أدخل PIN الخدمة من 4 إلى 8 أرقام");return;}
  const sim=(hardware[selected]||[]).find(item=>item.sim_uuid===pinConfigSim);
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
   setPinConfigSim(null);setServicePin("");
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
 const pinAction=(sim:Hardware)=><Space direction="vertical" size={4}>
  <Tag>{sim.has_pin?"مسجل بأمان":"غير مسجل"}</Tag>
  {sim.sim_uuid&&<Button size="small" disabled={pinConfigBusy}
   onClick={()=>{setServicePin("");setPinConfigSim(sim.sim_uuid);}}>
    {sim.has_pin?"تغيير PIN":"تسجيل PIN"}
   </Button>}
 </Space>;
 const phoneAction=(sim:Hardware)=>{
  if(!sim.sim_uuid)return <Typography.Text type="secondary">الشريحة غير محددة</Typography.Text>;
  const attempt=phoneAttempts[sim.sim_uuid];
  const state=phoneStateLabel(attempt);
  if(sim.msisdn)return <Tag color="green">الرقم معروف</Tag>;
  const operator=operatorOf(sim);
  return <Space direction="vertical" size={4}>
   <Tag color={attempt?.status==="success"?"green":attempt?.status==="running"?"blue":"orange"}>{state}</Tag>
   {attempt?.result_code&&<Typography.Text type="secondary" style={{fontSize:11}}>{attempt.result_code}</Typography.Text>}
   <Button size="small" loading={phoneBusy===sim.sim_uuid} disabled={hardwareLoading||operator==="unknown"||operator==="ooredoo"||(operator==="djezzy"&&!agentSupportsServiceCode(stations.find(station=>station.station_uuid===selected)?.agent_version||null))} onClick={()=>void discoverPhone(sim)}>معرفة الرقم تلقائيًا</Button>
   {operator==="ooredoo"&&<Typography.Text type="secondary" style={{fontSize:11}}>{guardMap[sim.sim_uuid]?.last_failed_at?"آخر فشل: "+dateLabel(guardMap[sim.sim_uuid].last_failed_at):"لا توجد محاولة موثقة"} — {cooldownActive(guardMap[sim.sim_uuid]?.cooldown_until)?"محظور حتى "+dateLabel(guardMap[sim.sim_uuid].cooldown_until):"المحاولات محمية ومقفلة افتراضيًا"}</Typography.Text>}
   {operator==="ooredoo"&&guardMap[sim.sim_uuid]?.last_failure_code&&<Typography.Text type="secondary" style={{fontSize:11}}>سبب الفشل: {guardMap[sim.sim_uuid].last_failure_code}</Typography.Text>}
   {operator==="ooredoo"&&<Button size="small" loading={rearmBusy===sim.sim_uuid} disabled={!!(cooldownActive(guardMap[sim.sim_uuid]?.cooldown_until))} onClick={()=>void rearmOoredoo(sim)}>إعادة السماح من الإدارة</Button>}
   {operator==="ooredoo"&&<Typography.Text type="secondary" style={{fontSize:11}}>كود *200*PIN# غير مفعّل حتى تثبت وظيفته ويُتحقق من PIN</Typography.Text>}
   {operator==="djezzy"&&!agentSupportsServiceCode(stations.find(station=>station.station_uuid===selected)?.agent_version||null)&&<Typography.Text type="secondary" style={{fontSize:11}}>جيزي 99 تحتاج Agent 0.4.11+</Typography.Text>}
   <Space.Compact style={{width:"100%"}}>
    <Input aria-label="رقم الشريحة يدويًا" dir="ltr" inputMode="tel" placeholder="0XXXXXXXXX" value={manualNumbers[sim.sim_uuid]||""} maxLength={20} onChange={event=>setManualNumbers(old=>({...old,[sim.sim_uuid!]:event.target.value}))}/>
    <Button loading={manualBusy===sim.sim_uuid} onClick={()=>void saveManualNumber(sim)}>حفظ يدوي</Button>
   </Space.Compact>
  </Space>;
 };
 const openHardware=async(uuid:string)=>{
  setSelected(uuid);setHardwareLoading(true);setError("");
  const {data,error}=await db.rpc("station_connect_admin_hardware",{p_station_uuid:uuid});
  setHardwareLoading(false);
  if(error){setError("تعذر قراءة المودمات والشرائح: "+error.message);return;}
  setHardware(previous=>({...previous,[uuid]:(data||[]) as Hardware[]}));setCheckedAt(new Date().toISOString());await Promise.all([loadPhoneAttempts(),loadOoredooGuards(),loadIdentityNames()]);
 };
 return <Space direction="vertical" size="middle" style={{width:"100%"}}>
  <SamaOperationalActions db={db}/>
  {error&&<Alert type="error" showIcon message={error}/>}
  {checkedAt&&<Typography.Text type="secondary">آخر تحديث: {dateLabel(checkedAt)}</Typography.Text>}
  <Card title={<Space wrap>المحطات</Space>} extra={<Button loading={loading} onClick={()=>void refresh()}>تحديث</Button>}>
   {mobile ? <Space direction="vertical" size="middle" style={{width:"100%"}}>
    {loading ? <Card loading size="small"/> : stations.length === 0 ? <Empty description="لا توجد محطات مرئية للحساب"/> : stations.map(station => <Card key={station.station_uuid} size="small" title={identityCell("station",station.station_uuid,station.computer_name||"محطة دون اسم")} extra={<Tag color={station.status==="approved"&&online(station.last_seen_at)?"green":"orange"}>{station.status==="approved"&&online(station.last_seen_at)?"متصل":"غير متصل"}</Tag>}>
      <Descriptions size="small" bordered column={1} items={[
       {key:"status",label:"الاعتماد",children:station.status},
       {key:"last",label:"آخر اتصال",children:dateLabel(station.last_seen_at)},
       {key:"version",label:"نسخة Agent",children:station.agent_version||"—"}
      ]}/>
      <Button style={{marginTop:12}} block onClick={()=>void openHardware(station.station_uuid)}>عرض مودمات المحطة</Button>
    </Card>)}
   </Space> : <Table rowKey="station_uuid" loading={loading} dataSource={stations} size="small" scroll={{x:620}} pagination={{pageSize:10}} locale={{emptyText:<Empty description="لا توجد محطات مرئية للحساب"/>}} columns={[
    {title:"الكمبيوتر",render:(_:unknown,r:Station)=>identityCell("station",r.station_uuid,r.computer_name||"محطة دون اسم")},
    {title:"الحالة",render:(_:unknown,r:Station)=><Space><Tag color={r.status==="approved"?"green":"default"}>{r.status}</Tag><Tag color={r.status==="approved"&&online(r.last_seen_at)?"green":"orange"}>{r.status==="approved"&&online(r.last_seen_at)?"متصل":"غير متصل"}</Tag></Space>},
    {title:"آخر اتصال",dataIndex:"last_seen_at",render:dateLabel},
    {title:"نسخة Agent",dataIndex:"agent_version",render:(v:string|null)=>v||"—"},
    {title:"المودمات",render:(_:unknown,r:Station)=><Button size="small" onClick={()=>void openHardware(r.station_uuid)}>عرض</Button>}
   ]}/>}
  </Card>
  {selected&&<Card title="المودمات والشرائح" extra={<Button loading={hardwareLoading} onClick={()=>void openHardware(selected)}>تحديث</Button>}>

   {mobile?<Space direction="vertical" style={{width:"100%"}} size="middle">{(hardware[selected]||[]).length===0&&!hardwareLoading?<Empty description="لا توجد مودمات مسجلة"/>:(hardware[selected]||[]).map(r=><Card key={r.modem_uuid+":"+(r.sim_uuid||"none")} size="small" title={<Space wrap><span>{r.device_name||"مودم"}</span><Tag color={online(r.modem_last_seen_at)?"green":"orange"}>{online(r.modem_last_seen_at)?"رُصد حديثًا":"لا يوجد رصد حديث"}</Tag></Space>}><Descriptions size="small" column={1} bordered items={[{key:"ip",label:"IP محلي",children:<span dir="ltr">{r.modem_ip||"—"}</span>},{key:"sim",label:"الشريحة",children:identityCell("sim",r.sim_uuid,r.sim_uuid?"نوع غير محدد":"بدون شريحة")},{key:"simPhone",label:"رقم الشريحة",children:<span dir="ltr">{r.msisdn||"غير معروف"}</span>},{key:"operator",label:"المتعامل",children:operatorNames[operatorOf(r)]},{key:"lookup",label:"معرفة الرقم",children:phoneAction(r)},{key:"type",label:"النوع",children:typeAction(r)},{key:"pin",label:"PIN",children:pinAction(r)},{key:"last",label:"آخر ظهور",children:dateLabel(r.modem_last_seen_at)}]}/></Card>)}</Space>:<Table rowKey={r=>r.modem_uuid+":"+(r.sim_uuid||"none")} loading={hardwareLoading} dataSource={hardware[selected]||[]} size="small" scroll={{x:720}} pagination={{pageSize:10}} columns={[
    {title:"المودم",render:(_:unknown,r:Hardware)=>r.device_name||r.modem_ip||"—"},
    {title:"IP محلي",dataIndex:"modem_ip",render:(v:string|null)=><span dir="ltr">{v||"—"}</span>},
    {title:"الشريحة",render:(_:unknown,r:Hardware)=>identityCell("sim",r.sim_uuid,r.sim_uuid?"نوع غير محدد":"بدون شريحة")},
     {title:"رقم الشريحة",dataIndex:"msisdn",render:(v:string|null)=><span dir="ltr">{v||"غير معروف"}</span>},
    {title:"المتعامل",render:(_:unknown,r:Hardware)=>operatorNames[operatorOf(r)]},
    {title:"معرفة الرقم",render:(_:unknown,r:Hardware)=>phoneAction(r)},
    {title:"النوع",render:(_:unknown,r:Hardware)=>typeAction(r)},
    {title:"PIN",render:(_:unknown,r:Hardware)=>pinAction(r)},
    {title:"آخر ظهور",dataIndex:"modem_last_seen_at",render:dateLabel},
    {title:"الاتصال",render:(_:unknown,r:Hardware)=><Tag color={online(r.modem_last_seen_at)?"green":"orange"}>{online(r.modem_last_seen_at)?"متصل حديثًا":"غير متصل"}</Tag>}
   ]}/>}
  </Card>}
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
   onCancel={()=>{if(!pinConfigBusy){setPinConfigSim(null);setServicePin("");}}}
   onOk={()=>void saveServicePin()}
   okText="حفظ PIN"
   okButtonProps={{disabled:!/^[0-9]{4,8}$/.test(servicePin)}}
   confirmLoading={pinConfigBusy}
   cancelText="إلغاء"
   maskClosable={!pinConfigBusy}
   closable={!pinConfigBusy}
  >
   <Space direction="vertical" size="middle" style={{width:"100%"}}>
    <Typography.Text>الشريحة: <span dir="ltr">{(hardware[selected||""]||[]).find(item=>item.sim_uuid===pinConfigSim)?.msisdn||"غير معروف"}</span></Typography.Text>
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
