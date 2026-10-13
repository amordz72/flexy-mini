import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Descriptions,Space,Tag,Typography,message} from "antd";
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

export default function SamaOperationalActions({db}:{db:SupabaseClient}){
 const [rows,setRows]=useState<SamaStatus[]>([]);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState<string|null>(null);
 const [queuedJob,setQueuedJob]=useState<string|null>(null);
 const load=useCallback(async()=>{
  setLoading(true);
  try{setRows(await readSamaStatus(db));setError("");}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setLoading(false);}
 },[db]);
 useEffect(()=>{void load();},[load]);

 const [pending,setPending]=useState<{kind:"approve"|"balance";simUuid:string}|null>(null);
 const [actionError,setActionError]=useState("");
 const chooseAction=(sim:SamaStatus,kind:"approve"|"balance")=>{
  if(busy)return;
  if(!sim.station_online||!sim.modem_online||!sim.sim_online||!sim.mobilis_network
    ||sim.sim_type!=="mobilis-sama"){
   message.warning("المحطة والشريحة يجب أن تكونا متصلتين ومُعرّفتين كـ Sama أولًا");return;
  }
  if(kind==="approve"&&!sim.has_service_pin){
   message.warning("يجب حفظ PIN خدمة Sama أولًا");return;
  }
  if(kind==="approve"&&sim.flexy_approved){
   message.info("الشريحة معتمدة مسبقًا");return;
  }
  setActionError("");
  setPending({kind,simUuid:sim.sim_uuid});
 };
 const executeConfirmedAction=async()=>{
  if(!pending||busy)return;
  const current=rows.find(sim=>sim.sim_uuid===pending.simUuid);
  if(!current){
   setActionError("الشريحة لم تعد موجودة في القائمة. اضغط تحديث الحالة.");
   setPending(null);return;
  }
  const action=pending.kind;
  const simUuid=pending.simUuid;
  // Network and authorization checks are repeated by the existing server RPC.
  // No command is issued by merely opening this inline confirmation.
  setBusy(simUuid);
  setActionError("");
  try{
   if(action==="approve"){
    const {error}=await db.rpc("station_connect_admin_set_sim_flexy_approval",
     {p_sim_uuid:simUuid,p_approved:true});
    if(error)throw error;
    message.success("تم اعتماد Sama إداريًا دون إرسال USSD");
   }else{
    const {data,error}=await db.rpc("station_connect_admin_queue_balance",
     {p_sim_uuid:simUuid});
    if(error)throw error;
    const result=(Array.isArray(data)?data[0]:data) as
      {job_uuid:string;status:string}|null;
    if(!result?.job_uuid)throw new Error("لم يرجع السيرفر مرجع طلب القراءة؛ تحقق من العمليات قبل إعادة الطلب");
    setQueuedJob(result.job_uuid);
    message.info("طلب قراءة الرصيد: "+result.status+". انتظر رد Station واضغط تحديث الحالة.");
   }
   setPending(null);
   await load();
  }catch(cause){
   const reason=cause instanceof Error?cause.message:String(cause);
   setActionError("تعذر "+(action==="approve"?"اعتماد الشريحة":"طلب قراءة الرصيد")+": "+reason);
   message.error("تعذّر الإجراء؛ التفاصيل أسفل الأزرار.");
   // Retain the confirmation panel to make the error visible in the same screen.
  }finally{
   setBusy(null);
  }
 };
 const visible=rows.filter(row=>row.station_online&&row.modem_online&&row.sim_online);
 return <Card title="تجهيز Sama لأول عملية" extra={<Button size="small" loading={loading} onClick={()=>void load()}>تحديث الحالة</Button>}>
  <Space direction="vertical" size="middle" style={{width:"100%"}}>
   <Typography.Text type="secondary">الخطوات: التأكد من شريحة Sama الفعلية، حفظ PIN الخدمة، اعتماد الشريحة، ثم فحص رصيدها. العرض والعمليات المالية لا تُنفذ من هذه البطاقة.</Typography.Text>
   {error&&<Alert type="error" showIcon message={error}/>}
   {visible.length===0?<Alert type="warning" showIcon message="لا توجد شريحة موبيليس مرصودة حديثًا"/>:
    visible.map(sim=><Card key={sim.sim_uuid} size="small"
      title={sim.station_name||"Station Connect"}
      extra={<Tag color={sim.discover_ready?"green":"orange"}>{sim.discover_ready?"جاهزة للاستكشاف":"تحتاج تجهيزًا"}</Tag>}>
      <Space direction="vertical" size="small" style={{width:"100%"}}>
       <Descriptions size="small" bordered column={1} items={[
        {key:"operator",label:"الشبكة",children:sim.mobilis_network?"Mobilis":"غير مؤكدة"},
        {key:"type",label:"نوع الشريحة",children:sim.sim_type||"غير محدد"},
        {key:"pin",label:"PIN الخدمة",children:sim.has_service_pin?"محفوظ بأمان":"غير محفوظ"},
        {key:"approval",label:"اعتماد الفليكسي",children:sim.flexy_approved?"معتمدة":"بانتظار موافقة الإدارة"},
        {key:"balance",label:"الرصيد التشغيلي",children:sim.balance_initialized
         ? (sim.operational_balance===null?"غير معروف":Number(sim.operational_balance).toLocaleString("en-US")+" دج")
         :"لم يُقرأ بعد"}
       ]}/>
       {!sim.has_service_pin||sim.sim_type!=="mobilis-sama"
        ? <Alert type="info" showIcon message="اضغط «عرض مودمات المحطة» في الأسفل، ثم «تجهيز Mobilis Sama» للشريحة الصحيحة، وأدخل رقمها وPIN الخدمة في الموقع."/>
        : null}
       {sim.has_service_pin&&sim.sim_type==="mobilis-sama"&&!sim.flexy_approved
         && <Button type="primary" block loading={busy===sim.sim_uuid}
           onClick={()=>chooseAction(sim,"approve")}>اعتماد الشريحة للتنفيذ</Button>}
       {sim.sim_type==="mobilis-sama"&&
        <Button block loading={busy===sim.sim_uuid} disabled={!sim.station_online||!sim.modem_online||!sim.sim_online}
          onClick={()=>chooseAction(sim,"balance")}>قراءة رصيد Sama عبر الشبكة</Button>}
       {pending?.simUuid===sim.sim_uuid&&
        <Card size="small" title="تأكيد الإجراء" style={{borderColor:"#2563eb"}}>
         <Space direction="vertical" size="small" style={{width:"100%"}}>
          <Alert showIcon type={pending.kind==="approve"?"info":"warning"}
           message={pending.kind==="approve"?"اعتماد شريحة Sama للتنفيذ":"قراءة رصيد Sama من الشبكة"}
           description={pending.kind==="approve"
            ?"تأكيد إداري لهذه الشريحة فقط. لا يرسل USSD ولا ينفذ شحنًا."
            :"سيُرسل طلب USSD واحدًا لقراءة الرصيد. هذا ليس شحنًا. لا تعاود الضغط إذا كانت النتيجة غير مؤكدة."}/>
          {actionError&&<Alert showIcon type="error" message={actionError}/>}
          <Space wrap>
           <Button type="primary" loading={busy===sim.sim_uuid}
            onClick={()=>void executeConfirmedAction()}>تأكيد الآن</Button>
           <Button disabled={busy===sim.sim_uuid}
            onClick={()=>{setPending(null);setActionError("");}}>إلغاء</Button>
          </Space>
         </Space>
        </Card>}
       {queuedJob&&<Typography.Text type="secondary" copyable={{text:queuedJob}}>
        آخر طلب رصيد: {queuedJob}
       </Typography.Text>}
       {sim.execute_prerequisites_ready
          ? <Tag color="green">متطلبات التنفيذ الأساسية جاهزة؛ يخضع كل عرض لفحص الرصيد والمسار</Tag>
          : <Typography.Text type="secondary">ما ينقص: {readinessProblems(sim).join("، ")}</Typography.Text>}
      </Space>
    </Card>)}
  </Space>
 </Card>;
}
