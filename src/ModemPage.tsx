import {useCallback,useEffect,useRef,useState} from "react";
import {Alert,Button,Card,Descriptions,Input,Progress,Space,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

// Modem page (owner, 2026-10-26): what the modem's own page at 192.168.8.1 shows, from the admin.
// Read-only status, plus a USSD lab. Owner's rule for the lab: no code is blocked (offer and
// PIN codes are the admin's responsibility); a code carrying a PIN waits 60 s and its reply.

type Status={
 signal?:Record<string,string|null>|null;network?:Record<string,string|null>|null;
 plmn?:Record<string,string|null>|null;sms_config?:Record<string,string|null>|null;
 device?:Record<string,string|null>|null;
 sms_count?:{local_inbox:number|null;local_max:number|null;local_unread:number|null;sim_inbox:number|null;sim_max:number|null}|null;
 errors?:Record<string,string>;read_at?:string;
};
type Page={
 modem_ip:string|null;device_name:string|null;modem_last_seen_at:string|null;sim_last_seen_at:string|null;
 ready:boolean;has_pin:boolean;same_ip_modems:number;
 status:{job_uuid:string;created_at:string;completed_at:string|null;command_status:string;error_code:string|null;error_message:string|null;raw_response:string|null}|null;
};
type Step={sequence:number;action:string;value:string|null;status:string;reply:string|null;error_code:string|null;error_message:string|null;created_at:string};
type Lab={session_uuid?:string;status?:string;steps?:Step[];pin_wait_seconds:number};

const reason=(e:unknown)=>{
 const text=e instanceof Error?e.message:typeof e==="object"&&e&&"message" in e?String((e as {message:unknown}).message):String(e);
 const wait=text.match(/LAB_PIN_COOLDOWN_(\d+)/);
 if(wait)return "كود فيه PIN: انتظر "+wait[1]+" ثانية قبل إرسال آخر";
 const known:Record<string,string>={
  SIM_NOT_READY:"الشريحة أو المودم أو الكمبيوتر غير متصل الآن",
  SMS_INBOX_SIM_NOT_READY:"الشريحة أو المودم أو الكمبيوتر غير متصل الآن",
  LAB_SESSION_OPEN:"جلسة سابقة ما زالت مفتوحة: أنهِها أولًا",
  LAB_WAITING_REPLY:"انتظر رد الخطوة السابقة",
  LAB_SESSION_CLOSED:"الجلسة انتهت: ابدأ كودًا جديدًا",
  LAB_LAST_STEP_NOT_ANSWERED:"الخطوة السابقة لم يصلها رد: أنهِ الجلسة وابدأ من جديد",
  PIN_NOT_SAVED:"لا يوجد PIN محفوظ لهذه الشريحة",
  LAB_CODE_CHARACTERS:"الكود يقبل الأرقام و* و# و+ و{PIN} فقط",
  LAB_CODE_MUST_START_WITH_STAR:"الكود يبدأ بـ * أو #",
  LAB_CODE_LENGTH:"الكود فارغ أو طويل جدًا",
 };
 const key=Object.keys(known).find(k=>text.includes(k));
 return key?known[key]:text;
};
const date=(v:string|null|undefined)=>v?new Date(v).toLocaleString("ar-DZ"):"—";
const tail=(v:string|null|undefined)=>v?"…"+v.slice(-6):"—";
const parse=(raw:string|null|undefined):Status|null=>{try{return raw?JSON.parse(raw) as Status:null;}catch{return null;}};
const networkType:Record<string,string>={"19":"4G","101":"4G","1011":"4G+","2":"3G","3":"3G","4":"3G","5":"3G","6":"3G","7":"3G","9":"3G","1":"2G","41":"3G","46":"3G"};
const simStatus:Record<string,string>={"0":"لا توجد شريحة أو غير صالحة","1":"الشريحة جاهزة","2":"شريحة غير صالحة","255":"لا توجد شريحة","240":"PIN الشريحة مطلوب"};
const busy=(s:string)=>s==="queued"||s==="claimed";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export default function ModemPage({db,simUuid,agentVersion}:{db:SupabaseClient;simUuid:string;agentVersion:string|null}){
 const [page,setPage]=useState<Page|null>(null);
 const [lab,setLab]=useState<Lab>({pin_wait_seconds:0});
 const [code,setCode]=useState("");
 const [reply,setReply]=useState("");
 const [reading,setReading]=useState(false);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState("");
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);

 const loadPage=useCallback(async()=>{
  const {data,error:e}=await db.rpc("station_connect_admin_modem_page",{p_sim_uuid:simUuid});
  if(e)throw e;
  if(alive.current)setPage(data as Page);
  return data as Page;
 },[db,simUuid]);
 const loadLab=useCallback(async()=>{
  const {data,error:e}=await db.rpc("station_connect_admin_ussd_lab_state",{p_sim_uuid:simUuid});
  if(e)throw e;
  if(alive.current)setLab(data as Lab);
  return data as Lab;
 },[db,simUuid]);
 useEffect(()=>{void Promise.all([loadPage(),loadLab()]).catch(e=>setError(reason(e)));},[loadPage,loadLab]);

 // Small countdown for the PIN wait, without asking the server every second.
 useEffect(()=>{
  if(lab.pin_wait_seconds<=0)return;
  const t=setTimeout(()=>setLab(l=>({...l,pin_wait_seconds:Math.max(0,l.pin_wait_seconds-1)})),1000);
  return()=>clearTimeout(t);
 },[lab.pin_wait_seconds]);

 const readStatus=async()=>{
  setReading(true);setError("");
  try{
   const {error:e}=await db.rpc("station_connect_admin_modem_status_queue",{p_sim_uuid:simUuid});
   if(e)throw e;
   for(let i=0;i<20&&alive.current;i++){
    await sleep(2500);
    const p=await loadPage();
    if(p?.status&&!busy(p.status.command_status))break;
   }
  }catch(e){setError(reason(e));}
  finally{setReading(false);}
 };

 const follow=async()=>{
  for(let i=0;i<40&&alive.current;i++){
   await sleep(2000);
   const l=await loadLab();
   if(!(l.steps||[]).some(s=>busy(s.status)))return;
  }
 };
 const run=async(fn:()=>Promise<unknown>)=>{
  setSending(true);setError("");
  try{await fn();await loadLab();await follow();}
  catch(e){setError(reason(e));await loadLab().catch(()=>{});}
  finally{setSending(false);}
 };
 const start=()=>run(async()=>{
  const {error:e}=await db.rpc("station_connect_admin_ussd_lab_start",{p_sim_uuid:simUuid,p_code:code.trim()});
  if(e)throw e;
  message.info("أُرسل الطلب إلى المحطة");
 });
 const answer=()=>run(async()=>{
  const {error:e}=await db.rpc("station_connect_admin_ussd_lab_reply",{p_session_uuid:lab.session_uuid,p_value:reply.trim()});
  if(e)throw e;
  setReply("");
 });
 const end=()=>run(async()=>{
  const {error:e}=await db.rpc("station_connect_admin_ussd_lab_release",{p_session_uuid:lab.session_uuid});
  if(e)throw e;
 });

 const status=parse(page?.status?.raw_response);
 const unsupported=page?.status?.error_code==="UNSUPPORTED_COMMAND_ACTION";
 const count=status?.sms_count;
 const fullness=count?.local_max?Math.round(100*(count.local_inbox||0)/count.local_max):null;
 const icon=Number(status?.network?.signal_icon||0),max=Number(status?.network?.max_signal||5)||5;
 const steps=lab.steps||[];
 const open=lab.status==="open"||lab.status==="closing";
 const waiting=steps.some(s=>busy(s.status));
 const lastOk=steps.length>0&&steps[steps.length-1].status==="success";
 const pinInCode=(v:string)=>/\{\s*pin\s*\}/i.test(v)||/\*\d{4,8}(?=[*#]|$)/.test(v);
 const pinBlocked=lab.pin_wait_seconds>0;

 return <Card size="small" title="صفحة المودم" extra={<Button size="small" loading={reading} disabled={!page?.ready} onClick={()=>void readStatus()}>اقرأ حالة المودم</Button>}>
  {error&&<Alert type="error" showIcon message={error} style={{marginBottom:8}}/>}
  {page&&page.same_ip_modems>0&&<Alert type="warning" showIcon style={{marginBottom:8}}
   message={`يوجد ${page.same_ip_modems} مودم آخر في نفس الكمبيوتر بنفس العنوان ${page.modem_ip||""} خلال آخر 5 أيام`}/>}
  {page&&!page.ready&&<Alert type="info" showIcon style={{marginBottom:8}} message="الشريحة أو المودم أو الكمبيوتر غير متصل الآن: القراءة والإرسال غير متاحين"/>}
  {unsupported&&<Alert type="warning" showIcon style={{marginBottom:8}} message={`قراءة حالة المودم تحتاج Agent 0.6.5 أو أحدث (الحالي: ${agentVersion||"غير معروف"}). اضغط «حدّث» في صفحة المحطات.`}/>}
  <Descriptions size="small" bordered column={1} items={[
   {key:"ip",label:"عنوان المودم",children:<span dir="ltr">{page?.modem_ip||"—"}</span>},
   {key:"signal",label:"الإشارة",children:status?.network?<Space>
     <Progress steps={max} percent={Math.round(100*icon/max)} showInfo={false} size="small"/>
     <span>{icon}/{max}</span>
     <Tag>{networkType[status.network.network_type||""]||status.network.network_type||"—"}</Tag>
     {status.signal?.rsrp&&<Typography.Text type="secondary" dir="ltr">RSRP {status.signal.rsrp} · SINR {status.signal.sinr||"—"}</Typography.Text>}
    </Space>:"—"},
   {key:"net",label:"الشبكة",children:status?.plmn?.name||status?.plmn?.short_name||"—"},
   {key:"sim",label:"حالة الشريحة",children:status?.network?.sim_status?simStatus[status.network.sim_status]||status.network.sim_status:"—"},
   {key:"store",label:"مخزن الرسائل",children:count?<Space direction="vertical" size={0} style={{width:"100%"}}>
     <Progress percent={fullness??0} size="small" status={(fullness??0)>=80?"exception":"normal"}/>
     <span>الجهاز: {count.local_inbox??"—"} من {count.local_max??"—"} (غير مقروءة {count.local_unread??"—"}) · الشريحة: {count.sim_inbox??"—"} من {count.sim_max??"—"}</span>
    </Space>:"—"},
   {key:"smsc",label:"مركز الرسائل (SMSC)",children:<span dir="ltr">{status?.sms_config?.smsc||"—"}</span>},
   {key:"id",label:"الهوية",children:<span dir="ltr">IMEI {tail(status?.device?.imei)} · ICCID {tail(status?.device?.iccid)}</span>},
   {key:"model",label:"الموديل",children:status?.device?.device_name||page?.device_name||"—"},
   {key:"read",label:"آخر قراءة",children:page?.status?<span>{date(status?.read_at||page.status.completed_at||page.status.created_at)}{page.status.error_code&&!unsupported?" · "+page.status.error_code:""}</span>:"لم تُقرأ بعد"},
  ]}/>
  {status?.errors&&Object.keys(status.errors).length>0&&<Typography.Paragraph type="secondary" style={{fontSize:11,marginTop:4}}>
   أجزاء لم يجب عليها المودم: {Object.entries(status.errors).map(([k,v])=>k+" ("+v+")").join("، ")}</Typography.Paragraph>}

  <Typography.Title level={5} style={{marginTop:16}}>تجربة USSD</Typography.Title>
  <Typography.Paragraph type="secondary" style={{fontSize:12}}>
   كل الأكواد مسموحة على مسؤولية الإدارة، بما فيها أكواد العروض والـPIN. اكتب {"{PIN}"} ليضع الخادم الـPIN المحفوظ دون أن يظهر.
   الكود الذي فيه PIN لا يتكرر قبل 60 ثانية ووصول رده.
  </Typography.Paragraph>
  <div dir="ltr" style={{background:"#f6f6f6",borderRadius:6,padding:8,minHeight:60,marginBottom:8,whiteSpace:"pre-wrap",fontFamily:"monospace",fontSize:13}}>
   {steps.length===0?<Typography.Text type="secondary">—</Typography.Text>:steps.map(s=><div key={s.sequence}>
    {s.action!=="ussd_release"&&<div><b>Sent:</b> {s.value}</div>}
    {s.action==="ussd_release"&&<div style={{color:"#888"}}>— انتهت الجلسة —</div>}
    {busy(s.status)&&s.action!=="ussd_release"&&<div style={{color:"#888"}}>… بانتظار الرد</div>}
    {s.reply&&<div dir="auto" style={{color:"#1d4ed8"}}><b>Received:</b> {s.reply}</div>}
    {s.status!=="success"&&!busy(s.status)&&<div style={{color:"#b91c1c"}}>{s.error_code||s.status}{s.error_message?" — "+s.error_message:""}</div>}
   </div>)}
  </div>
  {!open?<Space.Compact style={{width:"100%"}}>
    <Input dir="ltr" placeholder="*101#" value={code} onChange={e=>setCode(e.target.value)} onPressEnter={()=>code.trim()&&!sending&&!(pinBlocked&&pinInCode(code))&&void start()}/>
    <Button onClick={()=>setCode(c=>c.replace(/#?$/,"")+(c.endsWith("*")||!c?"":"*")+"{PIN}#")} disabled={!page?.has_pin}>أدرج PIN</Button>
    <Button type="primary" loading={sending} disabled={!page?.ready||!code.trim()||(pinBlocked&&pinInCode(code))} onClick={()=>void start()}>
     {pinBlocked&&pinInCode(code)?"انتظر "+lab.pin_wait_seconds+" ث":"أرسل"}</Button>
   </Space.Compact>
  :<Space direction="vertical" style={{width:"100%"}}>
    <Space.Compact style={{width:"100%"}}>
     <Input dir="ltr" placeholder="رد القائمة، مثل 1" value={reply} disabled={waiting||!lastOk} onChange={e=>setReply(e.target.value)}
      onPressEnter={()=>reply.trim()&&!sending&&!waiting&&lastOk&&void answer()}/>
     <Button onClick={()=>setReply(r=>r+"{PIN}")} disabled={!page?.has_pin||waiting}>PIN</Button>
     <Button type="primary" loading={sending&&!waiting} disabled={waiting||!lastOk||!reply.trim()||(pinBlocked&&pinInCode(reply))} onClick={()=>void answer()}>
      {pinBlocked&&pinInCode(reply)?"انتظر "+lab.pin_wait_seconds+" ث":"رد"}</Button>
    </Space.Compact>
    <Button danger block disabled={lab.status==="closing"} onClick={()=>void end()}>أنهِ الجلسة</Button>
   </Space>}
 </Card>;
}
