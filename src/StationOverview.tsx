import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Descriptions,Empty,Grid,Space,Table,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

type Station={station_uuid:string;status:string;computer_name:string|null;last_seen_at:string|null;agent_version:string|null};
type Hardware={modem_uuid:string;modem_ip:string|null;device_name:string|null;modem_last_seen_at:string|null;sim_uuid:string|null;msisdn:string|null;imsi:string|null;sim_type:string|null;has_pin:boolean;sim_last_seen_at:string|null};
type PhoneAttempt={sim_uuid:string;status:string;result_code:string|null;discovered_msisdn:string|null;started_at:string|null};
type PhoneQueue={queued:boolean;state:string;job_uuid:string|null};
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
 if(attempt.status==="queued"||attempt.status==="running")return "جاري البحث";
 if(attempt.status==="review")return "تحتاج مراجعة";
 if(attempt.status==="failed")return "فشل الاستعلام";
 return attempt.status||"غير معروف";
};
const online=(date:string|null)=>Boolean(date&&Date.now()-new Date(date).getTime()<90000);
const dateLabel=(value:string|null)=>value?new Date(value).toLocaleString("ar-DZ"):"—";
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
 const loadPhoneAttempts=useCallback(async()=>{
  const {data,error}=await db.rpc("station_connect_admin_sim_phone_discovery_state");
  if(error)return;
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
 useEffect(()=>{void refresh();void loadPhoneAttempts();},[refresh,loadPhoneAttempts]);
 const discoverPhone=async(sim:Hardware)=>{
  if(!sim.sim_uuid||sim.msisdn)return;
  const operator=operatorOf(sim);
  if(operator==="unknown"){message.warning("المتعامل غير معروف؛ يجب اكتشاف IMSI أولًا. لن نرسل كودًا عشوائيًا.");return;}
  if(operator==="ooredoo"){message.warning("أوريدو: كود PIN الخاص بالاستعلام لم يُتحقق منه ولا يوجد PIN مسجل. تم منع أي إرسال قد ينفذ شحنًا.");return;}
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
 const phoneAction=(sim:Hardware)=>{
  if(!sim.sim_uuid)return <Typography.Text type="secondary">الشريحة غير محددة</Typography.Text>;
  const attempt=phoneAttempts[sim.sim_uuid];
  const state=phoneStateLabel(attempt);
  if(sim.msisdn)return <Tag color="green">الرقم معروف</Tag>;
  const operator=operatorOf(sim);
  return <Space direction="vertical" size={4}>
   <Tag color={attempt?.status==="success"?"green":attempt?.status==="running"?"blue":"orange"}>{state}</Tag>
   {attempt?.result_code&&<Typography.Text type="secondary" style={{fontSize:11}}>{attempt.result_code}</Typography.Text>}
   <Button size="small" loading={phoneBusy===sim.sim_uuid} disabled={hardwareLoading||operator==="unknown"||operator==="ooredoo"} onClick={()=>void discoverPhone(sim)}>معرفة الرقم تلقائيًا</Button>
   {operator==="ooredoo"&&<Typography.Text type="secondary" style={{fontSize:11}}>بانتظار توثيق طريقة PIN الآمنة</Typography.Text>}
  </Space>;
 };
 const openHardware=async(uuid:string)=>{
  setSelected(uuid);setHardwareLoading(true);setError("");
  const {data,error}=await db.rpc("station_connect_admin_hardware",{p_station_uuid:uuid});
  setHardwareLoading(false);
  if(error){setError("تعذر قراءة المودمات والشرائح: "+error.message);return;}
  setHardware(previous=>({...previous,[uuid]:(data||[]) as Hardware[]}));setCheckedAt(new Date().toISOString());await loadPhoneAttempts();
 };
 return <Space direction="vertical" size="middle" style={{width:"100%"}}>
  <Alert type="info" showIcon message="اتصال للقراءة فقط مع Station Connect" description="تظهر المحطات والمودمات والشرائح من النظام الموجود. لا يتم إرسال USSD أو تنفيذ شحن، ولا تُعرض أسرار الشرائح."/>
  {error&&<Alert type="error" showIcon message={error}/>}
  <Alert type="info" showIcon message="معرفة رقم الشريحة من شبكة المتعامل" description="النظام يختار كود الاستعلام حسب IMSI: موبيليس *101#، جيزي 99. أوريدو ينتظر تأكيد كود PIN ولا ينفذ أي كود شحن." />
  <Alert type="info" showIcon message="اختبار اتصال للقراءة فقط" description={checkedAt?"آخر قراءة ناجحة من السيرفر: "+dateLabel(checkedAt)+". الاتصال بالمودم نفسه غير مختبر.":"اضغط تحديث لاختبار قراءة بيانات المحطات من السيرفر؛ لا يُرسل أي أمر إلى المودم."}/>
  <Card title={<Space wrap>المحطات <Tag color="blue">واجهة الهاتف v2.1</Tag></Space>} extra={<Button loading={loading} onClick={()=>void refresh()}>اختبار القراءة / تحديث</Button>}>
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
  {selected&&<Card title="المودمات والشرائح" extra={<Button loading={hardwareLoading} onClick={()=>void openHardware(selected)}>تحديث</Button>}>
   <Typography.Text type="secondary">قراءة المحطة المحددة فقط، دون تعديل الشريحة أو رمز PIN.</Typography.Text>
   {mobile?<Space direction="vertical" style={{width:"100%"}} size="middle">{(hardware[selected]||[]).length===0&&!hardwareLoading?<Empty description="لا توجد مودمات مسجلة"/>:(hardware[selected]||[]).map(r=><Card key={r.modem_uuid+":"+(r.sim_uuid||"none")} size="small" title={<Space wrap><span>{r.device_name||"مودم"}</span><Tag color={online(r.modem_last_seen_at)?"green":"orange"}>{online(r.modem_last_seen_at)?"متصل حديثًا":"غير متصل"}</Tag></Space>}><Descriptions size="small" column={1} bordered items={[{key:"ip",label:"IP محلي",children:<span dir="ltr">{r.modem_ip||"—"}</span>},{key:"sim",label:"الشريحة",children:<span dir="ltr">{r.msisdn||"غير معروف"}</span>},{key:"operator",label:"المتعامل",children:operatorNames[operatorOf(r)]},{key:"lookup",label:"معرفة الرقم",children:phoneAction(r)},{key:"type",label:"النوع",children:r.sim_type||"غير محدد"},{key:"pin",label:"PIN",children:r.has_pin?"مسجل بأمان":"غير مسجل"},{key:"last",label:"آخر ظهور",children:dateLabel(r.modem_last_seen_at)}]}/></Card>)}</Space>:<Table rowKey={r=>r.modem_uuid+":"+(r.sim_uuid||"none")} loading={hardwareLoading} dataSource={hardware[selected]||[]} size="small" scroll={{x:720}} pagination={{pageSize:10}} columns={[
    {title:"المودم",render:(_:unknown,r:Hardware)=>r.device_name||r.modem_ip||"—"},
    {title:"IP محلي",dataIndex:"modem_ip",render:(v:string|null)=><span dir="ltr">{v||"—"}</span>},
    {title:"الشريحة",dataIndex:"msisdn",render:(v:string|null)=><span dir="ltr">{v||"غير معروف"}</span>},
    {title:"المتعامل",render:(_:unknown,r:Hardware)=>operatorNames[operatorOf(r)]},
    {title:"معرفة الرقم",render:(_:unknown,r:Hardware)=>phoneAction(r)},
    {title:"النوع",dataIndex:"sim_type",render:(v:string|null)=>v||"غير محدد"},
    {title:"PIN",dataIndex:"has_pin",render:(v:boolean)=><Tag>{v?"مسجل بأمان":"غير مسجل"}</Tag>},
    {title:"آخر ظهور",dataIndex:"modem_last_seen_at",render:dateLabel},
    {title:"الاتصال",render:(_:unknown,r:Hardware)=><Tag color={online(r.modem_last_seen_at)?"green":"orange"}>{online(r.modem_last_seen_at)?"متصل حديثًا":"غير متصل"}</Tag>}
   ]}/>}
  </Card>}
 </Space>;
}
