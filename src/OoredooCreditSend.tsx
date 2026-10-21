import {useEffect,useRef,useState} from "react";
import {Alert,Button,InputNumber,Modal,Space,Typography} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

type Job={job_uuid:string;status:string;result_code?:string|null;result_text?:string|null;sim_label?:string|null};
const finalStatuses=new Set(["success","failed","review","unavailable"]);
export const ooredooRecipient=(phone:string)=>/^05[0-9]{8}$/.test(phone);
const statusLabel:Record<string,string>={claimed:"قيد الإرسال",queued:"في الطابور",success:"نجحت",failed:"فشلت",review:"تحتاج تأكيدًا",unavailable:"غير متاحة"};
const serverErrors:Record<string,string>={
 OOREDOO_SIM_NOT_APPROVED:"شريحة أوريدو متصلة لكنها غير معتمدة للفليكسي. اعتمدها من صفحة المحطات والشرائح.",
 OOREDOO_SIM_NOT_READY:"لا توجد شريحة أوريدو معتمدة ومتصلة برقم سري محفوظ.",
 OOREDOO_MODEM_BUSY:"المودم مشغول بعملية أخرى. انتظر قليلًا ثم أعد المحاولة.",
 OOREDOO_DUPLICATE_RECENT_SEND:"أُرسل نفس المبلغ لنفس الرقم قبل أقل من دقيقتين. لم يُرسل شيء جديد.",
 OOREDOO_590_CODE_NOT_BOUND:"كود إرسال أوريدو غير مفعّل لهذه الشريحة.",
 OOREDOO_RECIPIENT_REQUIRED:"الرقم ليس رقم أوريدو (يبدأ بـ05).",
 INVALID_AMOUNT:"المبلغ بين 40 و10000 دينار."
};
const explain=(cause:unknown)=>{
 const text=cause instanceof Error?cause.message:typeof cause==="object"&&cause&&"message" in cause?String((cause as {message:unknown}).message):String(cause);
 const known=Object.keys(serverErrors).find(code=>text.includes(code));
 return known?serverErrors[known]:text;
};

export default function OoredooCreditSend({db,phone}:{db:SupabaseClient;phone:string}){
 const [amount,setAmount]=useState<number|null>(null);
 const [confirm,setConfirm]=useState(false);
 const [busy,setBusy]=useState(false);
 const [job,setJob]=useState<Job|null>(null);
 const [error,setError]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const requestKey=useRef<string|null>(null);
 const lock=useRef(false);
 const valid=ooredooRecipient(phone)&&amount!==null&&Number.isInteger(amount)&&amount>=40&&amount<=10000;

 useEffect(()=>{requestKey.current=null;setJob(null);setError("");setUncertain(false);},[phone]);

 const poll=async(jobUuid:string)=>{
  for(let i=0;i<30;i++){
   await new Promise(resolve=>setTimeout(resolve,1000));
   const {data,error:pollError}=await db.rpc("station_connect_admin_ooredoo_flexy_job",{p_job_uuid:jobUuid});
   if(pollError)throw pollError;
   const row=(Array.isArray(data)?data[0]:data) as Job|null;
   if(!row||row.job_uuid!==jobUuid)throw new Error("تعذر تأكيد هوية نتيجة الإرسال");
   setJob(prev=>({...row,sim_label:prev?.sim_label}));
   if(finalStatuses.has(row.status))return;
  }
 };

 const send=async()=>{
  if(!valid||lock.current||job||uncertain)return;
  lock.current=true;setBusy(true);setConfirm(false);setError("");
  // One key per confirmed intent: a retry of the same request never dials twice.
  requestKey.current=requestKey.current||crypto.randomUUID();
  try{
   const {data,error:rpcError}=await db.rpc("station_connect_admin_send_ooredoo_flexy",{
    p_phone:phone,p_amount:amount,p_idempotency_key:requestKey.current
   });
   if(rpcError)throw rpcError;
   const row=(Array.isArray(data)?data[0]:data) as Job|null;
   if(!row?.job_uuid)throw new Error("لم يرجع السيرفر رقم العملية");
   setJob(row);
   await poll(row.job_uuid);
  }catch(cause){
   const message=explain(cause);
   if(Object.values(serverErrors).includes(message)){requestKey.current=null;setError(message);}
   else{setUncertain(true);setError("نتيجة الإرسال غير مؤكدة: "+message+" — لا تعاود الإرسال قبل التحقق من رسالة المستلم.");}
  }finally{lock.current=false;setBusy(false);}
 };

 const reset=()=>{requestKey.current=null;setJob(null);setError("");setUncertain(false);};

 return <Space direction="vertical" style={{width:"100%"}} size="middle">
  <Space wrap>{[100,200,500].map(value=><Button key={value} type={amount===value?"primary":"default"} disabled={busy||Boolean(job)}
   onClick={()=>setAmount(value)}>{value} دج</Button>)}</Space>
  <InputNumber<number> min={40} max={10000} precision={0} value={amount} disabled={busy||Boolean(job)}
   onChange={setAmount} style={{width:"100%"}} size="large" placeholder="المبلغ" addonAfter="دج"/>
  <Alert type="info" showIcon message="رصيد عادي أوريدو — إرسال مباشر"
   description="يُرسل من شريحة أوريدو المعتمدة المتصلة. أمر واحد إلى الشبكة بلا أي إعادة تلقائية."/>
  <Button block type="primary" loading={busy} disabled={!valid||busy||Boolean(job)||uncertain}
   onClick={()=>setConfirm(true)}>إرسال رصيد أوريدو</Button>
  {error&&<Alert type={uncertain?"warning":"error"} showIcon message={error}/>}
  {job&&<Alert showIcon type={job.status==="success"?"success":job.status==="failed"?"error":finalStatuses.has(job.status)?"warning":"info"}
   message={"العملية: "+(statusLabel[job.status]||job.status)}
   description={<Space direction="vertical">
    {job.sim_label&&<Typography.Text>الشريحة: {job.sim_label}</Typography.Text>}
    {job.result_text&&<Typography.Text>رد الشبكة: <bdi dir="ltr">{job.result_text}</bdi></Typography.Text>}
    {job.status==="review"&&<Typography.Text type="secondary">تأكد من وصول رسالة الشحن إلى المستلم قبل أي إرسال جديد.</Typography.Text>}
    <Typography.Text type="secondary" copyable={{text:job.job_uuid}}>مرجع العملية</Typography.Text>
    {finalStatuses.has(job.status)&&<Button size="small" onClick={reset}>طلب جديد بعد التحقق من النتيجة</Button>}
   </Space>}/>}
  {uncertain&&!job&&<Button size="small" onClick={reset}>تحققت من النتيجة — طلب جديد</Button>}
  <Modal title="تأكيد شحن رصيد حقيقي — أوريدو" open={confirm} okText="تأكيد الإرسال" cancelText="إلغاء"
   okButtonProps={{loading:busy,disabled:!valid}} onOk={()=>void send()} onCancel={()=>setConfirm(false)}>
   <Space direction="vertical">
    <Typography.Text strong>سيُرسل هذا الرصيد إلى شبكة أوريدو فعلًا.</Typography.Text>
    <Typography.Text>المستفيد: <bdi dir="ltr">{phone}</bdi></Typography.Text>
    <Typography.Text>المبلغ: {amount} دج</Typography.Text>
    <Typography.Text type="secondary">إذا ضاع رد الشبكة لا نعيد الشحن تلقائيًا.</Typography.Text>
   </Space>
  </Modal>
 </Space>;
}
