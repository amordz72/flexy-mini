import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Space,Table,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

type InboxJob={job_uuid:string;status:string;result_code:string|null;created_at:string};
type Sms={index?:string;sender?:string;date?:string;content?:string};
function parseMessages(raw:string):Sms[]{
 try{
  const parsed:unknown=JSON.parse(raw);
  if(Array.isArray(parsed))return parsed.filter((x):x is Sms=>Boolean(x&&typeof x==="object"));
  if(parsed&&typeof parsed==="object"){
   const o=parsed as Record<string,unknown>;
   for(const key of ["messages","sms","items"]){if(Array.isArray(o[key]))return (o[key] as Sms[]);}
  }
 }catch{/* preserve raw evidence */}
 return raw.trim()?[{content:raw}]:[];
}
export default function AdminSmsInbox({db,simUuid}:{db:SupabaseClient;simUuid:string}){
 const [jobs,setJobs]=useState<InboxJob[]>([]);
 const [messages,setMessages]=useState<Sms[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  setError("");
  const {data,error:jobError}=await db.from("station_connect_jobs")
   .select("job_uuid,status,result_code,created_at")
   .eq("sim_uuid",simUuid).eq("operation_key","sms.inbox.latest")
   .order("created_at",{ascending:false}).limit(10);
  if(jobError){setError(jobError.message);return;}
  const rows=(data||[]) as InboxJob[];
  setJobs(rows);
  const latest=rows[0];
  if(!latest){setMessages([]);return;}
  const {data:commands,error:commandError}=await db.from("station_connect_commands")
   .select("raw_response,status").eq("job_uuid",latest.job_uuid)
   .eq("action","sms_read").order("sequence",{ascending:false}).limit(1);
  if(commandError){setError(commandError.message);return;}
  const cmd=commands?.[0];
  setMessages(cmd?.status==="success"?parseMessages(String(cmd.raw_response||"")):[]);
 },[db,simUuid]);
 useEffect(()=>{void load();},[load]);
 const read=async()=>{
  setBusy(true);setError("");
  try{
   const {error:rpcError}=await db.rpc("station_connect_admin_queue_sms_inbox",{
    p_sim_uuid:simUuid,p_limit:20,p_source_job_uuid:null
   });
   if(rpcError)throw rpcError;
   message.success("تم طلب قراءة صندوق الرسائل. اضغط تحديث لمشاهدة النتيجة.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 return <Card size="small" title="سجل رسائل SMS — الإدارة" extra={<Space>
  <Button size="small" onClick={()=>void load()}>تحديث السجل</Button>
  <Button type="primary" size="small" loading={busy} onClick={()=>void read()}>قراءة آخر 20 رسالة</Button>
 </Space>}>
  <Typography.Paragraph type="secondary">قراءة فقط من الشريحة المحددة؛ لا حذف ولا إرسال رصيد. لا تُعتبر الرسالة إثبات نجاح مالي إلا بعد مطابقتها مع العملية.</Typography.Paragraph>
  {error&&<Alert type="error" showIcon message={error}/>}
  {jobs[0]&&<Typography.Paragraph>آخر طلب: {jobs[0].status} — {jobs[0].result_code||"قيد المعالجة"}</Typography.Paragraph>}
  <Table<Sms> size="small" rowKey={(r,i)=>r.index||String(i)} dataSource={messages} pagination={{pageSize:10}} scroll={{x:600}}
   locale={{emptyText:"لا توجد رسائل مقروءة بعد؛ اضغط قراءة ثم تحديث السجل"}}
   columns={[
    {title:"التاريخ",dataIndex:"date",width:175},
    {title:"المرسل",dataIndex:"sender",width:140},
    {title:"نص الرسالة",dataIndex:"content",render:(value:string)=><Typography.Text style={{whiteSpace:"pre-wrap"}}>{value||"—"}</Typography.Text>}
   ]}/>
 </Card>;
}
