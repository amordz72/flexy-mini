import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Descriptions,Empty,Grid,Space,Table,Tag,Typography} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

type Station={station_uuid:string;status:string;computer_name:string|null;last_seen_at:string|null;agent_version:string|null};
type Hardware={modem_uuid:string;modem_ip:string|null;device_name:string|null;modem_last_seen_at:string|null;sim_uuid:string|null;msisdn:string|null;sim_type:string|null;has_pin:boolean;sim_last_seen_at:string|null};
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
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  const {data,error}=await db.rpc("flexy_mini_station_overview");
  setLoading(false);
  if(error){setError("تعذر قراءة المحطات: "+error.message);return;}
  if(!Array.isArray(data)){setError("استجابة المحطات غير صالحة");return;}
  setStations(data as Station[]);setCheckedAt(new Date().toISOString());
 },[db]);
 useEffect(()=>{void refresh();},[refresh]);
 const openHardware=async(uuid:string)=>{
  setSelected(uuid);setHardwareLoading(true);setError("");
  const {data,error}=await db.rpc("station_connect_admin_hardware",{p_station_uuid:uuid});
  setHardwareLoading(false);
  if(error){setError("تعذر قراءة المودمات والشرائح: "+error.message);return;}
  setHardware(previous=>({...previous,[uuid]:(data||[]) as Hardware[]}));setCheckedAt(new Date().toISOString());
 };
 return <Space direction="vertical" size="middle" style={{width:"100%"}}>
  <Alert type="info" showIcon message="اتصال للقراءة فقط مع Station Connect" description="تظهر المحطات والمودمات والشرائح من النظام الموجود. لا يتم إرسال USSD أو تنفيذ شحن، ولا تُعرض أسرار الشرائح."/>
  {error&&<Alert type="error" showIcon message={error}/>}
  <Alert type="info" showIcon message="اختبار اتصال للقراءة فقط" description={checkedAt?"آخر قراءة ناجحة من السيرفر: "+dateLabel(checkedAt)+". الاتصال بالمودم نفسه غير مختبر.":"اضغط تحديث لاختبار قراءة بيانات المحطات من السيرفر؛ لا يُرسل أي أمر إلى المودم."}/>
  <Card title="المحطات" extra={<Button loading={loading} onClick={()=>void refresh()}>اختبار الاتصال / تحديث</Button>}>
   <Table rowKey="station_uuid" loading={loading} dataSource={stations} size="small" scroll={{x:620}} pagination={{pageSize:10}} locale={{emptyText:<Empty description="لا توجد محطات مرئية للحساب"/>}} columns={[
    {title:"الكمبيوتر",dataIndex:"computer_name",render:(v:string|null)=>v||"غير مسمى"},
    {title:"الحالة",render:(_:unknown,r:Station)=><Space><Tag color={r.status==="approved"?"green":"default"}>{r.status}</Tag><Tag color={r.status==="approved"&&online(r.last_seen_at)?"green":"orange"}>{r.status==="approved"&&online(r.last_seen_at)?"متصل":"غير متصل"}</Tag></Space>},
    {title:"آخر اتصال",dataIndex:"last_seen_at",render:dateLabel},
    {title:"نسخة Agent",dataIndex:"agent_version",render:(v:string|null)=>v||"—"},
    {title:"المودمات",render:(_:unknown,r:Station)=><Button size="small" onClick={()=>void openHardware(r.station_uuid)}>عرض</Button>}
   ]}/>
  </Card>
  {selected&&<Card title="المودمات والشرائح" extra={<Button loading={hardwareLoading} onClick={()=>void openHardware(selected)}>تحديث</Button>}>
   <Typography.Text type="secondary">قراءة المحطة المحددة فقط، دون تعديل الشريحة أو رمز PIN.</Typography.Text>
   {mobile?<Space direction="vertical" style={{width:"100%"}} size="middle">{(hardware[selected]||[]).length===0&&!hardwareLoading?<Empty description="لا توجد مودمات مسجلة"/>:(hardware[selected]||[]).map(r=><Card key={r.modem_uuid+":"+(r.sim_uuid||"none")} size="small" title={<Space wrap><span>{r.device_name||"مودم"}</span><Tag color={online(r.modem_last_seen_at)?"green":"orange"}>{online(r.modem_last_seen_at)?"متصل حديثًا":"غير متصل"}</Tag></Space>}><Descriptions size="small" column={1} bordered items={[{key:"ip",label:"IP محلي",children:<span dir="ltr">{r.modem_ip||"—"}</span>},{key:"sim",label:"الشريحة",children:<span dir="ltr">{r.msisdn||"غير معروف"}</span>},{key:"type",label:"النوع",children:r.sim_type||"غير محدد"},{key:"pin",label:"PIN",children:r.has_pin?"مسجل بأمان":"غير مسجل"},{key:"last",label:"آخر ظهور",children:dateLabel(r.modem_last_seen_at)}]}/></Card>)}</Space>:<Table rowKey={r=>r.modem_uuid+":"+(r.sim_uuid||"none")} loading={hardwareLoading} dataSource={hardware[selected]||[]} size="small" scroll={{x:720}} pagination={{pageSize:10}} columns={[
    {title:"المودم",render:(_:unknown,r:Hardware)=>r.device_name||r.modem_ip||"—"},
    {title:"IP محلي",dataIndex:"modem_ip",render:(v:string|null)=><span dir="ltr">{v||"—"}</span>},
    {title:"الشريحة",dataIndex:"msisdn",render:(v:string|null)=><span dir="ltr">{v||"غير معروف"}</span>},
    {title:"النوع",dataIndex:"sim_type",render:(v:string|null)=>v||"غير محدد"},
    {title:"PIN",dataIndex:"has_pin",render:(v:boolean)=><Tag>{v?"مسجل بأمان":"غير مسجل"}</Tag>},
    {title:"آخر ظهور",dataIndex:"modem_last_seen_at",render:dateLabel},
    {title:"الاتصال",render:(_:unknown,r:Hardware)=><Tag color={online(r.modem_last_seen_at)?"green":"orange"}>{online(r.modem_last_seen_at)?"متصل حديثًا":"غير متصل"}</Tag>}
   ]}/>
  </Card>}
 </Space>;
}
