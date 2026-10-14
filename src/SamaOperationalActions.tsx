import {useState} from "react";
import {Alert,Button,Space,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

export type SamaStatus={
  station_uuid:string;
  station_name:string|null;
  station_online:boolean;
  agent_version:string|null;
  sim_uuid:string;
  sim_type:string|null;
  mobilis_network:boolean;
  modem_online:boolean;
  sim_online:boolean;
  has_service_pin:boolean;
  flexy_approved:boolean;
  balance_initialized:boolean;
  operational_balance:number|null;
  balance_reconciliation_due:boolean;
  discover_ready:boolean;
  execute_prerequisites_ready:boolean;
};
export const readinessProblems=(row:SamaStatus):string[]=>{
 const missing:string[]=[];
 if(!row.station_online)missing.push("المحطة غير متصلة أو غير معتمدة");
 if(!row.modem_online||!row.sim_online)missing.push("المودم أو الشريحة لم يُرصدا حديثًا");
 if(!row.mobilis_network)missing.push("الشريحة ليست على شبكة موبيليس");
 if(row.sim_type!=="mobilis-sama")missing.push("نوع الشريحة غير مُسجل: يلزم تجهيز Mobilis Sama");
 if(!row.has_service_pin)missing.push("PIN خدمة Sama غير محفوظ");
 if(!row.flexy_approved)missing.push("الشريحة لم تُعتمد لتنفيذ الفليكسي");
 if(!row.balance_initialized)missing.push("لم يُسجل رصيد تشغيلي أولي للشريحة");
 if(row.balance_initialized&&Number(row.operational_balance)<=0)missing.push("الرصيد التشغيلي غير كافٍ");
 if(row.balance_reconciliation_due)missing.push("يلزم مطابقة الرصيد مع الشبكة");
 return missing;
};
export async function readSamaStatus(db:SupabaseClient):Promise<SamaStatus[]>{
 const result=await db.rpc("flexy_mini_admin_sama_readiness");
 if(result.error)throw result.error;
 return (Array.isArray(result.data)?result.data:[]) as SamaStatus[];
}

// The parent StationOverview reads readiness once and places controls under the owning SIM.
// This component must never enumerate all SIMs or render a separate "شرائح Sama" list.
export default function SamaOperationalActions({db,sim,onRefresh}:{
 db:SupabaseClient;sim:SamaStatus;onRefresh:()=>Promise<void>;
}){
 const [pending,setPending]=useState<"approve"|"balance"|null>(null);
 const [busy,setBusy]=useState(false);
 const [actionError,setActionError]=useState("");
 const [queuedJob,setQueuedJob]=useState<string|null>(null);
 if(sim.sim_type!=="mobilis-sama")return null;
 const chooseAction=(kind:"approve"|"balance")=>{
  if(busy)return;
  if(!sim.station_online||!sim.modem_online||!sim.sim_online||!sim.mobilis_network){
   message.warning("المحطة والشريحة يجب أن تكونا متصلتين وعلى شبكة موبيليس أولًا");return;
  }
  if(kind==="approve"&&!sim.has_service_pin){
   message.warning("يجب حفظ PIN خدمة Sama أولًا");return;
  }
  if(kind==="approve"&&sim.flexy_approved){
   message.info("الشريحة معتمدة مسبقًا");return;
  }
  setActionError("");setPending(kind);
 };
 const executeConfirmedAction=async()=>{
  if(!pending||busy)return;
  const action=pending;
  setBusy(true);setActionError("");
  try{
   if(action==="approve"){
    const {error}=await db.rpc("station_connect_admin_set_sim_flexy_approval",
     {p_sim_uuid:sim.sim_uuid,p_approved:true});
    if(error)throw error;
    message.success("تم اعتماد Sama إداريًا دون إرسال USSD");
   }else{
    const {data,error}=await db.rpc("station_connect_admin_queue_balance",
     {p_sim_uuid:sim.sim_uuid});
    if(error)throw error;
    const result=(Array.isArray(data)?data[0]:data) as {job_uuid:string;status:string}|null;
    if(!result?.job_uuid)throw new Error("لم يرجع السيرفر مرجع طلب القراءة؛ تحقق من العمليات قبل إعادة الطلب");
    setQueuedJob(result.job_uuid);
    message.info("طلب قراءة الرصيد: "+result.status+". انتظر رد Station وحدّث الحالة.");
   }
   setPending(null);
   await onRefresh();
  }catch(cause){
   setActionError("تعذر "+(action==="approve"?"اعتماد الشريحة":"طلب قراءة الرصيد")+": "+(cause instanceof Error?cause.message:String(cause)));
   message.error("تعذّر الإجراء؛ التفاصيل أسفل الأزرار.");
  }finally{setBusy(false);}
 };
 return <Space direction="vertical" size="small" style={{width:"100%"}}>
  {!sim.has_service_pin&&<Alert type="info" showIcon message="PIN خدمة Sama غير محفوظ"/>}
  {sim.has_service_pin&&!sim.flexy_approved&&
   <Button type="primary" block loading={busy} onClick={()=>chooseAction("approve")}>اعتماد الشريحة للتنفيذ</Button>}
  <Button block loading={busy} disabled={!sim.station_online||!sim.modem_online||!sim.sim_online}
   onClick={()=>chooseAction("balance")}>قراءة رصيد Sama عبر الشبكة</Button>
  {pending&&<Alert type="warning" showIcon
   message={pending==="approve"?"تأكيد اعتماد الشريحة":"تأكيد قراءة رصيد الشبكة"}
   description={<Space wrap>
    <Typography.Text>{pending==="approve"?"اعتماد إداري دون إرسال USSD":"سيُطلب استعلام رصيد واحد من Station"}</Typography.Text>
    <Button type="primary" loading={busy} onClick={()=>void executeConfirmedAction()}>تأكيد الآن</Button>
    <Button disabled={busy} onClick={()=>{setPending(null);setActionError("");}}>إلغاء</Button>
   </Space>}/>}
  {actionError&&<Alert showIcon type="error" message={actionError}/>}
  {queuedJob&&<Typography.Text type="secondary" copyable={{text:queuedJob}}>آخر طلب رصيد: {queuedJob}</Typography.Text>}
  {!sim.execute_prerequisites_ready&&
   <Typography.Text type="secondary">ما ينقص: {readinessProblems(sim).join("، ")}</Typography.Text>}
  {sim.execute_prerequisites_ready&&<Tag color="green">متطلبات التنفيذ الأساسية جاهزة؛ يبقى فحص العرض والمسار</Tag>}
 </Space>;
}
