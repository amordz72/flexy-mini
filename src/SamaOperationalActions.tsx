import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Descriptions,Modal,Space,Tag,Typography,message} from "antd";
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

 const confirmApprove=(sim:SamaStatus)=>{
  if(!sim.station_online||!sim.sim_online||!sim.modem_online||!sim.mobilis_network
    ||sim.sim_type!=="mobilis-sama"||!sim.has_service_pin){
    message.warning("عرّف الشريحة وPIN الخدمة وتأكد من اتصالها أولًا");return;
  }
  Modal.confirm({
   title:"اعتماد شريحة Sama لتنفيذ الفليكسي",
   content:"هذا اعتماد إداري للشريحة الموجودة فعليًا. لا ينفذ شحنًا ولا يفتح جلسة USSD. بعد الاعتماد يلزم فحص الرصيد قبل أي عملية مالية.",
   okText:"اعتماد الشريحة",cancelText:"إلغاء",
   onOk:async()=>{
    setBusy(sim.sim_uuid);
    try{
      const {error}=await db.rpc("station_connect_admin_set_sim_flexy_approval",{p_sim_uuid:sim.sim_uuid,p_approved:true});
      if(error)throw error;
      message.success("تم اعتماد الشريحة إداريًا دون شحن");
      await load();
    }catch(e){message.error("تعذر الاعتماد: "+(e instanceof Error?e.message:String(e)));}
    finally{setBusy(null);}
   }
  });
 };
 const confirmBalance=(sim:SamaStatus)=>{
  if(!sim.station_online||!sim.modem_online||!sim.sim_online||!sim.mobilis_network||sim.sim_type!=="mobilis-sama"){
    message.warning("مطلوب اتصال شريحة Sama الصحيح قبل الاستعلام");return;
  }
  Modal.confirm({
   title:"قراءة رصيد شريحة Sama",
   content:"سيتم إنشاء طلب USSD لقراءة رصيد شريحة Sama عبر Station Connect. هذه ليست عملية شحن؛ لكنّها اتصال حقيقي بالشبكة. لا تكرر الطلب قبل ظهور النتيجة.",
   okText:"تأكيد فحص الرصيد",cancelText:"إلغاء",
   onOk:async()=>{
    setBusy(sim.sim_uuid);
    try{
      const {data,error}=await db.rpc("station_connect_admin_queue_balance",{p_sim_uuid:sim.sim_uuid});
      if(error)throw error;
      const result=(Array.isArray(data)?data[0]:data) as {job_uuid:string;status:string}|null;
      setQueuedJob(result?.job_uuid||null);
      message.info("طلب قراءة الرصيد: "+(result?.status||"تم الإرسال")+". اضغط تحديث بعد رد Station.");
      await load();
    }catch(e){message.error("تعذر فحص الرصيد: "+(e instanceof Error?e.message:String(e)));}
    finally{setBusy(null);}
   }
  });
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
           onClick={()=>confirmApprove(sim)}>اعتماد الشريحة للتنفيذ</Button>}
       {sim.sim_type==="mobilis-sama"&&
        <Button block loading={busy===sim.sim_uuid} disabled={!sim.station_online||!sim.modem_online||!sim.sim_online}
          onClick={()=>confirmBalance(sim)}>قراءة رصيد Sama عبر الشبكة</Button>}
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
