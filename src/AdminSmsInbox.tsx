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
type Count={local_inbox:number|null;local_max:number|null;local_unread:number|null};
function parseCount(raw:string):Count|null{
 try{const o=JSON.parse(raw) as {sms_count?:Count|null};return o&&typeof o==="object"&&o.sms_count?o.sms_count:null;}catch{return null;}
}
export default function AdminSmsInbox({db,simUuid}:{db:SupabaseClient;simUuid:string}){
 const [jobs,setJobs]=useState<InboxJob[]>([]);
 const [messages,setMessages]=useState<Sms[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [store,setStore]=useState<Count|null>(null);
 const load=useCallback(async()=>{
  setError("");
  setJobs([]);setMessages([]);
  const {data,error:historyError}=await db.rpc("station_connect_admin_sms_inbox_history",{p_sim_uuid:simUuid});
  if(historyError){setError(historyError.message);return null;}
  const rows=(data||[]) as Array<InboxJob&{raw_response:string|null;command_status:string|null}>;
  setJobs(rows.map(row=>({...row,status:row.command_status==="success"?"success":row.status})));
  const latest=rows.find(row=>row.command_status==="success" && row.raw_response) || rows[0];
  setMessages(latest?.raw_response?parseMessages(String(latest.raw_response)).filter(m=>m.sender||m.content||!String(m.date||"").startsWith("1999")):[]);
  setStore(latest?.raw_response?parseCount(String(latest.raw_response)):null);
  return rows[0]?.command_status||rows[0]?.status||null;
 },[db,simUuid]);
 useEffect(()=>{void load();},[load]);
 const read=async()=>{
  setBusy(true);setError("");
  try{
   const {error:rpcError}=await db.rpc("station_connect_admin_queue_sms_inbox",{
    p_sim_uuid:simUuid,p_limit:20,p_source_job_uuid:null
   });
   if(rpcError)throw rpcError;
   message.info("أُرسل طلب القراءة إلى المحطة");
   // Follow the read until the station answers (about 2 to 10 seconds), no manual refresh.
   for(let i=0;i<15;i++){
    await new Promise(r=>setTimeout(r,2000));
    const state=await load();
    if(state&&!["queued","claimed"].includes(state))break;
   }
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 return <Card size="small" title="قارئ الرسائل" extra={<Space>
  <Button size="small" onClick={()=>void load()}>تحديث السجل</Button>
  <Button type="primary" size="small" loading={busy} onClick={()=>void read()}>قراءة آخر 20 رسالة</Button>
 </Space>}>
  <Typography.Paragraph type="secondary">قراءة فقط من الشريحة المحددة؛ لا حذف ولا إرسال رصيد. لا تُعتبر الرسالة إثبات نجاح مالي إلا بعد مطابقتها مع العملية.</Typography.Paragraph>
  {error&&<Alert type="error" showIcon message={error}/>}
  {store&&<Typography.Paragraph type={(store.local_inbox||0)>=0.8*(store.local_max||500)?"danger":"secondary"}>مخزن المودم: {store.local_inbox??"—"} من {store.local_max??"—"} رسالة؛ إذا امتلأ لا تصل رسائل جديدة.</Typography.Paragraph>}
  {jobs[0]&&<Typography.Paragraph>آخر طلب: {jobs[0].status} — {jobs[0].result_code||"قيد المعالجة"}</Typography.Paragraph>}
  <Table<Sms> size="small" rowKey={(r,i)=>r.index||String(i)} dataSource={messages} pagination={{pageSize:10}} scroll={{x:600}}
   locale={{emptyText:"لا توجد رسائل مقروءة بعد؛ اضغط «قراءة آخر 20 رسالة»"}}
   columns={[
    {title:"التاريخ",dataIndex:"date",width:175},
    {title:"المرسل",dataIndex:"sender",width:140},
    {title:"نص الرسالة",dataIndex:"content",render:(value:string)=><Typography.Text style={{whiteSpace:"pre-wrap"}}>{value||"—"}</Typography.Text>}
   ]}/>
 </Card>;
}
