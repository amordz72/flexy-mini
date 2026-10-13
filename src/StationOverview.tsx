import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Descriptions,Empty,Grid,Input,Modal,Space,Table,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";
import SamaOperationalActions from "./SamaOperationalActions";

type Station={station_uuid:string;status:string;computer_name:string|null;last_seen_at:string|null;agent_version:string|null};
type Hardware={modem_uuid:string;modem_ip:string|null;device_name:string|null;modem_last_seen_at:string|null;sim_uuid:string|null;msisdn:string|null;imsi:string|null;sim_type:string|null;has_pin:boolean;sim_last_seen_at:string|null};
type PhoneAttempt={sim_uuid:string;attempt_uuid:string;job_uuid:string|null;status:string;job_status:string|null;result_code:string|null;result_message:string|null;discovered_msisdn:string|null;auto_triggered:boolean;started_at:string|null;completed_at:string|null;command_error_code:string|null;command_error_message:string|null};
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
 if(attempt.status==="queued")return "في الانتظار";
 if(attempt.status==="running")return "جاري البحث";
 if(attempt.status==="review")return "تحتاج مراجعة";
 if(attempt.status==="failed")return "فشل الاستعلام";
 if(attempt.status==="unavailable")return "الاستعلام غير متاح";
 return attempt.status||"غير معروف";
};
const online=(date:string|null)=>Boolean(date&&Date.now()-new Date(date).getTime()<90000);
const dateLabel=(value:string|null)=>value?new Date(value).toLocaleString("ar-DZ"):"—";
const isPhonePending=(attempt:PhoneAttempt|undefined)=>attempt?.status==="queued"||attempt?.status==="running";
const phoneWaitExceeded=(attempt:PhoneAttempt|undefined)=>Boolean(attempt&&isPhonePending(attempt)&&attempt.started_at&&Date.now()-new Date(attempt.started_at).getTime()>150000);
const phoneMessage=(attempt:PhoneAttempt|undefined)=>{
 if(!attempt)return "";
 if(phoneWaitExceeded(attempt))return "تأخر الطلب أكثر من دقيقتين ونصف، ولم يحسم السيرفر النتيجة بعد. لا تعاود الإرسال قبل مراجعة الحالة.";
 return attempt.result_message||attempt.command_error_message||"";
};
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
 const [samaConfigSim,setSamaConfigSim]=useState<string|null>(null);
 const [samaPhone,setSamaPhone]=useState("");
 const [servicePin,setServicePin]=useState("");
 const [samaConfigBusy,setSamaConfigBusy]=useState(false);
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
  const {data,error}=await db.rpc("station_connect_admin_sim_phone_diagnostics");
  if(error){setError("تعذر قراءة نتيجة معرفة الأرقام: "+error.message);return;}
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
 useEffect(()=>{void refresh();void loadPhoneAttempts();void loadOoredooGuards();},[refresh,loadPhoneAttempts,loadOoredooGuards]);
 const hasPendingPhoneAttempts=Object.values(phoneAttempts).some(isPhonePending);
 useEffect(()=>{
  if(!hasPendingPhoneAttempts)return;
  const timer=window.setInterval(()=>{void loadPhoneAttempts();},10000);
  return ()=>window.clearInterval(timer);
 },[hasPendingPhoneAttempts,loadPhoneAttempts]);
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
 const configureSama=async()=>{
  if(!samaConfigSim||!selected)return;
  const number=normalizePhone(samaPhone);
  if(!/^0[5-7]\d{8}$/.test(number)){message.warning("أدخل رقم الشريحة الصحيح من 10 أرقام أولًا");return;}
  if(!/^[0-9]{4,8}$/.test(servicePin)){message.warning("أدخل PIN الخدمة من 4 إلى 8 أرقام");return;}
  const sim=(hardware[selected]||[]).find(item=>item.sim_uuid===samaConfigSim);
  if(!sim||sim.sim_type!=="unknown"||!sim.imsi?.startsWith("60301")||!online(sim.sim_last_seen_at)||!online(sim.modem_last_seen_at)){
   message.warning("الشريحة لم تعد ظاهرة حديثًا كموبيليس؛ حدّث بيانات المودم قبل تجهيزها");return;
  }
  const station=stations.find(item=>item.station_uuid===selected);
  if(!station||station.status!=="approved"||!online(station.last_seen_at)){
   message.warning("اتصال المحطة غير حديث؛ حدّث حالة المحطة أولًا");return;
  }
  setSamaConfigBusy(true);
  try{
   const {error}=await db.rpc("station_connect_admin_update_sim",{
    p_sim_uuid:sim.sim_uuid,p_msisdn:number,p_sim_type:"mobilis-sama",p_service_pin:servicePin
   });
   if(error)throw error;
   setHardware(old=>Object.fromEntries(Object.entries(old).map(([uuid,items])=>[uuid,items.map(item=>item.sim_uuid===samaConfigSim?{...item,msisdn:number,sim_type:"mobilis-sama",has_pin:true}:item)])));
   setSamaConfigSim(null);setSamaPhone("");setServicePin("");
   message.success("تم تسجيل رقم الشريحة ونوع Sama وPIN الخدمة، دون إرسال USSD.");
  }catch(cause){message.error("تعذر تجهيز Sama: "+(cause instanceof Error?cause.message:String(cause)));}
  finally{setSamaConfigBusy(false);}
 };
 const typeAction=(sim:Hardware)=><Space direction="vertical" size={4}>
  <span>{sim.sim_type||"غير محدد"}</span>
  {sim.sim_uuid&&sim.sim_type==="unknown"&&sim.imsi?.startsWith("60301")&&online(sim.sim_last_seen_at)&&online(sim.modem_last_seen_at)&&
   <Button size="small" onClick={()=>{setSamaPhone(sim.msisdn||"");setServicePin("");setSamaConfigSim(sim.sim_uuid);}}>تجهيز Mobilis Sama</Button>}
 </Space>;
 const phoneAction=(sim:Hardware)=>{
  if(!sim.sim_uuid)return <Typography.Text type="secondary">الشريحة غير محددة</Typography.Text>;
  const attempt=phoneAttempts[sim.sim_uuid];
  const state=phoneStateLabel(attempt);
  const operator=operatorOf(sim);
  const delayed=phoneWaitExceeded(attempt);
  const failed=attempt?.status==="failed"||attempt?.status==="review"||attempt?.status==="unavailable";
  const showDetails=()=>{
   if(!attempt)return;
   Modal.info({
    title:"تفاصيل معرفة رقم الشريحة",width:620,okText:"إغلاق",
    content:<Descriptions bordered size="small" column={1} items={[
     {key:"number",label:"رقم الشريحة",children:<span dir="ltr">{sim.msisdn||attempt.discovered_msisdn||"غير معروف"}</span>},
     {key:"state",label:"الحالة",children:state},
     {key:"message",label:"النتيجة / الخطأ",children:phoneMessage(attempt)||"لم تصل نتيجة نهائية بعد"},
     {key:"code",label:"رمز النتيجة",children:<span dir="ltr">{attempt.result_code||"—"}</span>},
     {key:"commandError",label:"خطأ الأمر",children:<span dir="ltr">{attempt.command_error_code||"—"}</span>},
     {key:"start",label:"وقت الطلب",children:dateLabel(attempt.started_at)},
     {key:"complete",label:"وقت الانتهاء",children:dateLabel(attempt.completed_at)},
     {key:"job",label:"معرّف العملية",children:attempt.job_uuid?<Typography.Text copyable={{text:attempt.job_uuid}}>{attempt.job_uuid}</Typography.Text>:"—"}
    ]}/>
   });
  };
  return <Space direction="vertical" size={4}>
   {sim.msisdn&&<Tag color="green">الرقم معروف</Tag>}
   {attempt&&<Tag color={attempt.status==="success"?"green":failed?"red":delayed?"orange":"blue"}>{delayed?"تأخر الطلب — يحتاج تحقق":state}</Tag>}
   {attempt?.result_code&&<Typography.Text type={failed?"danger":"secondary"} style={{fontSize:11}}>{attempt.result_code}</Typography.Text>}
   {(failed||delayed)&&<Typography.Text type="danger" style={{fontSize:12}}>{phoneMessage(attempt)}</Typography.Text>}
   {attempt&&<Space size={8} wrap><Typography.Text type="secondary" style={{fontSize:11}}>آخر طلب: {dateLabel(attempt.started_at)}</Typography.Text><Button type="link" size="small" onClick={showDetails}>تفاصيل النتيجة</Button></Space>}
   {!sim.msisdn&&<Button size="small" loading={phoneBusy===sim.sim_uuid} disabled={hardwareLoading||isPhonePending(attempt)||operator==="unknown"||operator==="ooredoo"||(operator==="djezzy"&&!agentSupportsServiceCode(stations.find(station=>station.station_uuid===selected)?.agent_version||null))} onClick={()=>void discoverPhone(sim)}>معرفة الرقم تلقائيًا</Button>}
   {operator==="ooredoo"&&<Typography.Text type="secondary" style={{fontSize:11}}>{guardMap[sim.sim_uuid]?.last_failed_at?"آخر فشل: "+dateLabel(guardMap[sim.sim_uuid].last_failed_at):"لا توجد محاولة موثقة"} — {cooldownActive(guardMap[sim.sim_uuid]?.cooldown_until)?"محظور حتى "+dateLabel(guardMap[sim.sim_uuid].cooldown_until):"المحاولات محمية ومقفلة افتراضيًا"}</Typography.Text>}
   {operator==="ooredoo"&&guardMap[sim.sim_uuid]?.last_failure_code&&<Typography.Text type="secondary" style={{fontSize:11}}>سبب الفشل: {guardMap[sim.sim_uuid].last_failure_code}</Typography.Text>}
   {operator==="ooredoo"&&<Button size="small" loading={rearmBusy===sim.sim_uuid} disabled={!!(cooldownActive(guardMap[sim.sim_uuid]?.cooldown_until))} onClick={()=>void rearmOoredoo(sim)}>إعادة السماح من الإدارة</Button>}
   {operator==="ooredoo"&&<Typography.Text type="secondary" style={{fontSize:11}}>كود *200*PIN# غير مفعّل حتى تثبت وظيفته ويُتحقق من PIN</Typography.Text>}
   {operator==="djezzy"&&!agentSupportsServiceCode(stations.find(station=>station.station_uuid===selected)?.agent_version||null)&&<Typography.Text type="secondary" style={{fontSize:11}}>جيزي 99 تحتاج Agent 0.4.11+</Typography.Text>}
   {!sim.msisdn&&<Space.Compact style={{width:"100%"}}>
    <Input aria-label="رقم الشريحة يدويًا" dir="ltr" inputMode="tel" placeholder="0XXXXXXXXX" value={manualNumbers[sim.sim_uuid]||""} maxLength={20} onChange={event=>setManualNumbers(old=>({...old,[sim.sim_uuid!]:event.target.value}))}/>
    <Button loading={manualBusy===sim.sim_uuid} onClick={()=>void saveManualNumber(sim)}>حفظ يدوي</Button>
   </Space.Compact>}
  </Space>;
 };
 const openHardware=async(uuid:string)=>{
  setSelected(uuid);setHardwareLoading(true);setError("");
  const {data,error}=await db.rpc("station_connect_admin_hardware",{p_station_uuid:uuid});
  setHardwareLoading(false);
  if(error){setError("تعذر قراءة المودمات والشرائح: "+error.message);return;}
  setHardware(previous=>({...previous,[uuid]:(data||[]) as Hardware[]}));setCheckedAt(new Date().toISOString());await Promise.all([loadPhoneAttempts(),loadOoredooGuards()]);
 };
 return <Space direction="vertical" size="middle" style={{width:"100%"}}>
  <SamaOperationalActions db={db}/>
  {error&&<Alert type="error" showIcon message={error}/>}
  {checkedAt&&<Typography.Text type="secondary">آخر تحديث: {dateLabel(checkedAt)}</Typography.Text>}
  <Card title={<Space wrap>المحطات</Space>} extra={<Button loading={loading} onClick={()=>{void refresh();void loadPhoneAttempts();}}>تحديث</Button>}>
   {mobile ? <Space direction="vertical" size="middle" style={{width:"100%"}}>
    {loading ? <Card loading size="small"/> : stations.length === 0 ? <Empty description="لا توجد محطات مرئية للحساب"/> : stations.map(station => <Card key={station.station_uuid} size="small" title={station.computer_name||"محطة دون اسم"} extra={<Tag color={station.status==="approved"&&online(station.last_seen_at)?"green":"orange"}>{station.status==="approved"&&online(station.last_seen_at)?"متصل":"غير متصل"}</Tag>}>
      <Descriptions size="small" bordered column={1} items={[
       {key:"status",label:"الاعتماد",children:station.status},
       {key:"last",label:"آخر اتصال",children:dateLabel(station.last_seen_at)},
       {key:"version",label:"نسخة Agent",children:station.agent_version||"—"}
      ]}/>
      <Button style={{marginTop:12}} block onClick={()=>void openHardware(station.station_uuid)}>عرض مودمات المحطة</Button>
    </Card>)}
   </Space> : <Table rowKey="station_uuid" loading={loading} dataSource={stations} size="small" scroll={{x:620}} pagination={{pageSize:10}} locale={{emptyText:<Empty description="لا توجد محطات مرئية للحساب"/>}} columns={[
    {title:"الكمبيوتر",dataIndex:"computer_name",render:(v:string|null)=>v||"غير مسمى"},
    {title:"الحالة",render:(_:unknown,r:Station)=><Space><Tag color={r.status==="approved"?"green":"default"}>{r.status}</Tag><Tag color={r.status==="approved"&&online(r.last_seen_at)?"green":"orange"}>{r.status==="approved"&&online(r.last_seen_at)?"متصل":"غير متصل"}</Tag></Space>},
    {title:"آخر اتصال",dataIndex:"last_seen_at",render:dateLabel},
    {title:"نسخة Agent",dataIndex:"agent_version",render:(v:string|null)=>v||"—"},
    {title:"المودمات",render:(_:unknown,r:Station)=><Button size="small" onClick={()=>void openHardware(r.station_uuid)}>عرض</Button>}
   ]}/>}
  </Card>
  {selected&&<Card title="المودمات والشرائح" extra={<Button loading={hardwareLoading} onClick={()=>{void openHardware(selected);void loadPhoneAttempts();}}>تحديث</Button>}>

   {mobile?<Space direction="vertical" style={{width:"100%"}} size="middle">{(hardware[selected]||[]).length===0&&!hardwareLoading?<Empty description="لا توجد مودمات مسجلة"/>:(hardware[selected]||[]).map(r=><Card key={r.modem_uuid+":"+(r.sim_uuid||"none")} size="small" title={<Space wrap><span>{r.device_name||"مودم"}</span><Tag color={online(r.modem_last_seen_at)?"green":"orange"}>{online(r.modem_last_seen_at)?"رُصد حديثًا":"لا يوجد رصد حديث"}</Tag></Space>}><Descriptions size="small" column={1} bordered items={[{key:"ip",label:"IP محلي",children:<span dir="ltr">{r.modem_ip||"—"}</span>},{key:"sim",label:"الشريحة",children:<span dir="ltr">{r.msisdn||"غير معروف"}</span>},{key:"operator",label:"المتعامل",children:operatorNames[operatorOf(r)]},{key:"lookup",label:"معرفة الرقم",children:phoneAction(r)},{key:"type",label:"النوع",children:typeAction(r)},{key:"pin",label:"PIN",children:r.has_pin?"مسجل بأمان":"غير مسجل"},{key:"last",label:"آخر ظهور",children:dateLabel(r.modem_last_seen_at)}]}/></Card>)}</Space>:<Table rowKey={r=>r.modem_uuid+":"+(r.sim_uuid||"none")} loading={hardwareLoading} dataSource={hardware[selected]||[]} size="small" scroll={{x:720}} pagination={{pageSize:10}} columns={[
    {title:"المودم",render:(_:unknown,r:Hardware)=>r.device_name||r.modem_ip||"—"},
    {title:"IP محلي",dataIndex:"modem_ip",render:(v:string|null)=><span dir="ltr">{v||"—"}</span>},
    {title:"الشريحة",dataIndex:"msisdn",render:(v:string|null)=><span dir="ltr">{v||"غير معروف"}</span>},
    {title:"المتعامل",render:(_:unknown,r:Hardware)=>operatorNames[operatorOf(r)]},
    {title:"معرفة الرقم",render:(_:unknown,r:Hardware)=>phoneAction(r)},
    {title:"النوع",render:(_:unknown,r:Hardware)=>typeAction(r)},
    {title:"PIN",dataIndex:"has_pin",render:(v:boolean)=><Tag>{v?"مسجل بأمان":"غير مسجل"}</Tag>},
    {title:"آخر ظهور",dataIndex:"modem_last_seen_at",render:dateLabel},
    {title:"الاتصال",render:(_:unknown,r:Hardware)=><Tag color={online(r.modem_last_seen_at)?"green":"orange"}>{online(r.modem_last_seen_at)?"متصل حديثًا":"غير متصل"}</Tag>}
   ]}/>}
  </Card>}
  <Modal
   title="تجهيز شريحة Mobilis Sama"
   open={Boolean(samaConfigSim)}
   onCancel={()=>{if(!samaConfigBusy){setSamaConfigSim(null);setSamaPhone("");setServicePin("");}}}
   onOk={()=>void configureSama()}
   okText="حفظ الرقم والنوع وPIN"
   okButtonProps={{disabled:!(/^0[5-7]\d{8}$/.test(normalizePhone(samaPhone))&&/^[0-9]{4,8}$/.test(servicePin))}}
   confirmLoading={samaConfigBusy}
   cancelText="إلغاء"
   maskClosable={!samaConfigBusy}
   closable={!samaConfigBusy}
  >
   <Alert type="warning" showIcon message="تأكيد هوية الشريحة" description="يحفظ تعريف Sama في سجل الشرائح المشترك." style={{marginBottom:12}}/>
   <Typography.Text strong>1. رقم هاتف الشريحة</Typography.Text>
   <Input
    aria-label="رقم هاتف شريحة Sama" dir="ltr" inputMode="tel" maxLength={20}
    style={{marginTop:8,marginBottom:16}}
    placeholder="0XXXXXXXXX"
    value={samaPhone} onChange={event=>setSamaPhone(event.target.value)}
   />

   <div style={{marginTop:16}}><Typography.Text strong>2. PIN خدمة Sama (4 إلى 8 أرقام)</Typography.Text></div>
   <Input.Password
    style={{marginTop:8}} inputMode="numeric" autoComplete="new-password" maxLength={8}
    value={servicePin} onChange={event=>setServicePin(event.target.value.replace(/\D/g,""))}
    placeholder="PIN الخدمة — لا يظهر في الشاشة"
   />
  </Modal>
 </Space>;
}
