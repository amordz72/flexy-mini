import {useCallback,useEffect,useRef,useState} from "react";
import {Alert,Button,Collapse,Descriptions,Space,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

type AccountBalance={
 account_key:string;distributor_account_code:string|null;account_name:string;
 balance_amount:number;currency:string;checked_at:string;
};
type BalanceJob={
 job_uuid:string;status:string;result_code:string|null;result_text:string|null;
 created_at?:string;completed_at?:string|null;
};
type RecentResponse=BalanceJob&{response_kind:string};
const amount=(value:number)=>Number(value).toLocaleString("en-US",{maximumFractionDigits:2})+" دج";
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString("ar-DZ"):"—";
const ongoing=(status:string)=>status==="queued"||status==="claimed";
const reason=(error:unknown)=>error instanceof Error?error.message:String(error);

// Existing Station Connect RPCs own the balance workflow and the stored distributor accounts.
// This component only reads existing data; requesting a new network query requires TWO clicks.
export default function ArsselliBalanceActions({db,simUuid,canRequestBalance}:{
 db:SupabaseClient;simUuid:string;canRequestBalance:boolean;
}){
 const [accounts,setAccounts]=useState<AccountBalance[]>([]);
 const [responses,setResponses]=useState<RecentResponse[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [loading,setLoading]=useState(false);
 const [pending,setPending]=useState(false);
 const [sending,setSending]=useState(false);
 const [checking,setChecking]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [job,setJob]=useState<BalanceJob|null>(null);
 const [error,setError]=useState("");
 const requestLock=useRef(false);

 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const [balanceResult,responseResult]=await Promise.all([
    db.rpc("station_connect_admin_arsselli_balances",{p_sim_uuid:simUuid}),
    db.rpc("station_connect_admin_arsselli_recent_responses",{p_sim_uuid:simUuid,p_limit:8})
   ]);
   if(balanceResult.error)throw balanceResult.error;
   if(responseResult.error)throw responseResult.error;
   const balances=(Array.isArray(balanceResult.data)?balanceResult.data:[]) as AccountBalance[];
   const history=(Array.isArray(responseResult.data)?responseResult.data:[]) as RecentResponse[];
   setAccounts(balances);setResponses(history);setLoaded(true);setError("");
   // Recover a pending job on page reload rather than silently allowing a second query.
   const pendingJob=history.find(row=>ongoing(row.status));
   if(pendingJob)setJob(previous=>previous?.job_uuid===pendingJob.job_uuid?previous:pendingJob);
   return history;
  }catch(cause){
   setError("تعذر قراءة أرصدة أرسلي المسجلة: "+reason(cause));
   return null;
  }finally{setLoading(false);}
 },[db,simUuid]);

 useEffect(()=>{
  setAccounts([]);setResponses([]);setJob(null);setPending(false);setUncertain(false);setLoaded(false);
  void refresh();
 },[refresh]);

 const activeJob=Boolean(job&&ongoing(job.status))||responses.some(row=>ongoing(row.status));
 const canQueue=canRequestBalance&&!sending&&!requestLock.current&&!uncertain&&!activeJob;

 const queue=async()=>{
  if(!pending||!canQueue)return;
  requestLock.current=true;setSending(true);setPending(false);setError("");
  try{
   const {data,error:rpcError}=await db.rpc("station_connect_admin_queue_arsselli_balance",{p_sim_uuid:simUuid});
   if(rpcError)throw rpcError;
   const result=(Array.isArray(data)?data[0]:data) as {job_uuid:string;status:string}|null;
   if(!result?.job_uuid){
    setUncertain(true);
    throw new Error("السيرفر لم يرجع رقم الطلب؛ لا تكرر الاستعلام قبل مراجعة سجل العمليات");
   }
   setJob({job_uuid:result.job_uuid,status:result.status,result_code:null,result_text:null});
   message.info("تم تسجيل استعلام واحد لرصيد أرسلي؛ انتظر الرد أو حدّث الحالة");
  }catch(cause){
   // A transport failure is ambiguous. No automatic retry or second job.
   setUncertain(true);
   setError("تعذر تأكيد طلب رصيد أرسلي: "+reason(cause)+" — راجع آخر الردود قبل إعادة المحاولة");
  }finally{requestLock.current=false;setSending(false);}
 };

 const checkJob=async()=>{
  if(!job||checking)return;
  setChecking(true);setError("");
  try{
   const {data,error:rpcError}=await db.rpc("station_connect_admin_arsselli_balance_job",{p_job_uuid:job.job_uuid});
   if(rpcError)throw rpcError;
   const result=(Array.isArray(data)?data[0]:data) as BalanceJob|null;
   if(!result||result.job_uuid!==job.job_uuid)throw new Error("لا توجد نتيجة مؤكدة لهذا الطلب");
   setJob(result);
   if(!ongoing(result.status))await refresh();
  }catch(cause){setError("تعذر متابعة الطلب: "+reason(cause));}
  finally{setChecking(false);}
 };

 const gts=accounts.find(item=>item.distributor_account_code==="04"||item.account_name?.trim().toUpperCase()==="GTS");
 const others=accounts.filter(item=>item!==gts&&Number(item.balance_amount)!==0);
 const lastResponse=job?.result_text?job:responses[0]||null;
 const responseItems=responses.slice(0,5).map(row=>({
  key:row.job_uuid,
  label:date(row.completed_at||row.created_at),
  children:<Space direction="vertical" size={2}>
   <Tag>{row.result_code||row.status}</Tag>
   <Typography.Text style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{row.result_text||"لا يوجد نص مؤكد"}</Typography.Text>
  </Space>
 }));

 return <Space direction="vertical" size="small" style={{width:"100%"}}>
  <Typography.Text strong>رصيد أرسلي — حسابات الموزعين</Typography.Text>
  {loading&&!loaded&&<Typography.Text type="secondary">جاري قراءة الأرصدة المسجلة...</Typography.Text>}
  {loaded&&<Descriptions size="small" bordered column={1} items={[
   {key:"gts",label:"GTS (04)",children:gts?amount(gts.balance_amount):"لم يُقرأ بعد"},
   ...others.map(a=>({key:a.account_key,label:a.account_name,children:amount(a.balance_amount)})),
   {key:"checked",label:"آخر قراءة مؤكدة",children:date(gts?.checked_at||accounts[0]?.checked_at)}
  ]}/>}
  {!canRequestBalance&&<Typography.Text type="secondary">قراءة الشبكة تتطلب محطة ومودامًا وشريحة متصلة، مع PIN محفوظ.</Typography.Text>}
  <Space wrap size="small">
   <Button disabled={!canQueue} loading={sending} onClick={()=>setPending(true)}>قراءة رصيد أرسلي عبر الشبكة</Button>
   <Button loading={loading} onClick={()=>void refresh()}>تحديث الرصيد المسجل</Button>
  </Space>
  {pending&&<Alert type="warning" showIcon message="تأكيد استعلام رصيد أرسلي"
   description={<Space direction="vertical" size="small">
    <Typography.Text>سيُرسل استعلام شبكة واحد لهذه الشريحة فقط. لن يتم شحن رصيد أو إعادة إرسال الطلب تلقائيًا.</Typography.Text>
    <Space wrap><Button type="primary" loading={sending} disabled={!canQueue} onClick={()=>void queue()}>تأكيد الآن</Button>
     <Button disabled={sending} onClick={()=>setPending(false)}>إلغاء</Button></Space>
   </Space>}/>}
  {job&&<Alert type={job.result_code==="ARSSELLI_BALANCE_SMS"?"success":job.status==="failed"?"error":"info"} showIcon
   message={job.result_code==="ARSSELLI_BALANCE_SMS"?"وصلت رسالة الرصيد وحُفظت":
     job.result_code==="BALANCE_SMS_PENDING"?"الرد غير محسوم: لم تتأكد رسالة SMS جديدة":
     "حالة طلب الرصيد: "+job.status}
   description={<Space direction="vertical" size={4}>
    <Typography.Text copyable={{text:job.job_uuid}}>رقم الطلب: {job.job_uuid}</Typography.Text>
    {job.result_code&&<Typography.Text>رمز النتيجة: {job.result_code}</Typography.Text>}
    <Button size="small" loading={checking} onClick={()=>void checkJob()}>تحديث حالة الطلب</Button>
   </Space>}/>}
  {uncertain&&<Alert type="warning" showIcon message="نتيجة إنشاء الاستعلام غير مؤكدة؛ لا تعاود الإرسال تلقائيًا"/>}
  {error&&<Alert type="error" showIcon message={error}/>}
  {(lastResponse||responseItems.length>0)&&<Collapse size="small" items={[{
   key:"responses",label:"آخر ردود أرسلي",
   children:responseItems.length>0?<Descriptions size="small" column={1} items={responseItems}/>:
    <Typography.Text style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{lastResponse?.result_text||"لا يوجد رد نصي"}</Typography.Text>
  }]}/>}
 </Space>;
}
