import {useEffect,useState} from "react";
import {Alert,Button,Card,Input,Select,Space,Table,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

type Template={id:string;name:string;prefix:string;purpose:string;verified:boolean};
const initial:Template[]=[
 {id:"credit",name:"رصيد عادي",prefix:"*630*",purpose:"ordinary-credit",verified:false},
 {id:"plan",name:"شراء عرض",prefix:"*696*1*",purpose:"offer-activation",verified:false},
 {id:"balance",name:"قراءة الرصيد",prefix:"*632*01*",purpose:"balance-inquiry",verified:false},
 {id:"transfer",name:"تحويل نقاط البيع",prefix:"*631*",purpose:"pos-transfer",verified:false},
 {id:"international",name:"شحن دولي",prefix:"*633*1*",purpose:"international",verified:false},
 {id:"numbers",name:"قائمة أرقام الفليكسي",prefix:"*632*03*",purpose:"number-list",verified:false},
 {id:"transfers",name:"قائمة التحويلات",prefix:"*631*01*",purpose:"transfer-list",verified:false},
 {id:"pin",name:"تغيير PIN",prefix:"*632*02*",purpose:"pin-change",verified:false}
];
export default function ArsselliLabCatalog({db}:{db:SupabaseClient}){
 const [items,setItems]=useState<Template[]>(initial);
 const [selected,setSelected]=useState("credit");
 const [code,setCode]=useState("*630*");
 const [name,setName]=useState("رصيد عادي");
 const [notes,setNotes]=useState("");
 const [saved,setSaved]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{let live=true;void db.rpc("flexy_mini_admin_arsselli_lab_templates").then(({data,error})=>{
  if(!live)return;
  if(error){setError("حفظ قوالب المختبر في قاعدة البيانات غير متاح حتى تثبيت Migration الخادم.");return;}
  if(Array.isArray(data)&&data.length){const rows=data.map((r:any)=>({id:String(r.template_key),name:String(r.display_name),prefix:String(r.ussd_prefix),purpose:String(r.purpose),verified:Boolean(r.verified)}));setItems(rows);}
 }).catch(()=>{if(live)setError("خدمة القوالب غير متاحة.");});return()=>{live=false;};},[db]);
 const choose=(id:string)=>{setSelected(id);const t=items.find(x=>x.id===id);if(t){setCode(t.prefix);setName(t.name);}setSaved(false);};
 const save=async()=>{if(!/^\*[0-9*]+\*$/.test(code)||code.length>40){message.error("صيغة المقدمة غير صحيحة");return;}
 setSaving(true);try{const {error}=await db.rpc("flexy_mini_admin_upsert_arsselli_lab_template",{p_template_key:selected,p_display_name:name,p_ussd_prefix:code});if(error)throw error;
 setItems(xs=>xs.map(x=>x.id===selected?{...x,prefix:code,name,verified:false}:x));setSaved(true);message.success("تم الحفظ في قاعدة البيانات");}catch{message.error("لم يُحفظ التعديل: خدمة الخادم غير جاهزة");}finally{setSaving(false);}};
 return <Card title="مختبر أكواد أرسلي — إدارة القوالب" size="small">
 <Space direction="vertical" style={{width:"100%"}}>
 <Alert type="warning" showIcon message="مرجع تاريخي غير معتمد للتنفيذ المالي" description="هذه شاشة إعداد الأكواد فقط. لا ترسل USSD ولا تخصم رصيدًا. تنفيذ الشبكة يحتاج مسارًا خادميًا آمنًا مع رد USSD وSMS منفصلين."/>
 {error&&<Alert type="info" showIcon message={error}/>}
 <Table size="small" rowKey="id" pagination={false} dataSource={items} columns={[{title:"العملية",dataIndex:"name"},{title:"مقدمة الكود",dataIndex:"prefix",render:(v:string)=><Typography.Text code>{v}</Typography.Text>},{title:"الاعتماد",dataIndex:"verified",render:(v:boolean)=><Tag color={v?"green":"default"}>{v?"معتمد":"تجريبي"}</Tag>}]}/>
 <Typography.Text strong>تعديل القالب</Typography.Text>
 <Select value={selected} onChange={choose} options={items.map(x=>({value:x.id,label:x.name}))}/>
 <Input value={name} onChange={e=>{setName(e.target.value);setSaved(false);}} placeholder="اسم العملية"/>
 <Input dir="ltr" value={code} onChange={e=>{setCode(e.target.value);setSaved(false);}} placeholder="*630*"/>
 <Button type="primary" loading={saving} onClick={()=>void save()}>حفظ في قاعدة البيانات</Button>
 {saved&&<Tag color="green">تم الحفظ</Tag>}
 <Typography.Text type="secondary">سجل الردود: رد جلسة USSD ورسالة SMS واردة إلى الشريحة يُحفظان منفصلين عند تفعيل مسار الاختبار الآمن.</Typography.Text>
 </Space></Card>;
}
