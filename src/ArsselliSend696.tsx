import {useState,useRef,useEffect} from "react";
import {Alert,Button,Modal,Select,Space,Typography} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

type Job={job_uuid:string;status:string;result_code?:string|null;result_text?:string|null};
const normalizePhone=(value:string)=>value.replace(/\D/g,"").replace(/^213/,"0");
const accounts=[{value:"03",label:"03 — DATA"},{value:"04",label:"04 — GTS"}];
export default function ArsselliSend696({db,phone,amount}:{db:SupabaseClient;phone:string;amount:number|null}){
 const [account,setAccount]=useState("03");
 // Historical Mobilis documentation classifies 696/1 as offer purchase, not ordinary credit.
 const ordinaryCreditRouteVerified=false;
 const [stationUuid,setStationUuid]=useState<string|null>(null);
 const [ready,setReady]=useState(false);
 useEffect(()=>{if(typeof db.from!=="function")return;let live=true;void db.from("station_connect_stations").select("station_uuid,status,last_seen_at").eq("status","approved").order("last_seen_at",{ascending:false}).limit(1).then(({data})=>{if(!live)return;const station=data?.[0];setStationUuid(station?.station_uuid||null);setReady(Boolean(station&&Date.now()-Date.parse(station.last_seen_at)<90000));});return()=>{live=false;};},[db]);
 const [confirm,setConfirm]=useState(false);
 const [busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [job,setJob]=useState<Job|null>(null);
 const [error,setError]=useState("");
 const lock=useRef(false);
 const normalized=normalizePhone(phone);
 const valid=/^0[5-7][0-9]{8}$/.test(normalized)&&Number.isInteger(amount)&&Number(amount)>0&&Number(amount)<=50000;
 const send=async()=>{
  if(!ordinaryCreditRouteVerified||!ready||!stationUuid||!valid||!confirm||lock.current||job||uncertain)return;
  lock.current=true;setBusy(true);setConfirm(false);setError("");
  try{
   const {data,error:rpcError}=await db.rpc("station_connect_admin_create_arsselli_flexy_696",{
    p_phone:normalized,p_amount:amount,p_station_uuid:stationUuid,p_distributor_account_code:account
   });
   if(rpcError)throw rpcError;
   const result=(Array.isArray(data)?data[0]:data) as Job|null;
   if(!result?.job_uuid)throw new Error("لم يرجع السيرفر رقم العملية");
   setJob(result);
  }catch(e){
   setUncertain(true);
   setError("نتيجة طلب الإرسال غير مؤكدة: "+(e instanceof Error?e.message:String(e))+" — لا تعاود الإرسال قبل مراجعة السجل");
  }finally{lock.current=false;setBusy(false);}
 };
 const check=async()=>{
  if(!job)return;
  setBusy(true);
  try{
   const {data,error:rpcError}=await db.rpc("station_connect_admin_arsselli_flexy_696_job",{p_job_uuid:job.job_uuid});
   if(rpcError)throw rpcError;
   const result=(Array.isArray(data)?data[0]:data) as Job|null;
   if(result?.job_uuid===job.job_uuid)setJob(result);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 return <Space direction="vertical" style={{width:"100%"}} size="small">
  <Typography.Text strong>إرسال رصيد عادي — ينتظر اعتماد كود 630</Typography.Text>
  <Alert type="warning" showIcon message="إرسال الرصيد العادي متوقف مؤقتًا: 696 مخصص للعروض حسب وثيقة موبيليس القديمة؛ نحتاج مسار 630 معتمدًا قبل الإرسال." />
  <Select aria-label="حساب الموزع" value={account} options={accounts} onChange={setAccount}/>
  <Typography.Text type="secondary">الرصيد يُراجع قبل التنفيذ خارج دالة الإرسال. لا يتم الاستعلام عنه تلقائيًا هنا.</Typography.Text>
  <Button type="primary" disabled={!ordinaryCreditRouteVerified||!ready||!stationUuid||!valid||busy||uncertain||Boolean(job)} onClick={()=>setConfirm(true)}>إرسال رصيد</Button>
  {!ready&&<Alert type="warning" showIcon message="الشريحة أو المحطة غير جاهزة"/>}
  {error&&<Alert type="error" showIcon message={error}/>}
  {uncertain&&<Alert type="warning" showIcon message="لا تكرر العملية؛ راجع سجل الإرسال أولًا"/>}
  {job&&<Alert type="info" showIcon message={"حالة العملية: "+job.status} description={<Space direction="vertical"><Typography.Text copyable>{job.job_uuid}</Typography.Text><Typography.Text>{job.result_code||"بانتظار رد الشبكة"}</Typography.Text><Typography.Text>{job.result_text||""}</Typography.Text><Button loading={busy} onClick={()=>void check()}>تحديث نتيجة العملية</Button></Space>}/>}
  <Modal title="تأكيد إرسال رصيد مالي" open={confirm} okText="تأكيد الإرسال مرة واحدة" okButtonProps={{loading:busy}} onOk={()=>void send()} onCancel={()=>setConfirm(false)}>
   <Typography.Paragraph>إرسال {amount} دج إلى {normalized} عبر حساب {account}. تأكد من الرصيد قبل الموافقة. لا توجد إعادة إرسال تلقائية.</Typography.Paragraph>
  </Modal>
 </Space>;
}
