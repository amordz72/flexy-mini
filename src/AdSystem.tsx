import React,{useEffect,useState} from "react";
import {Button,Card,Form,Input,Select,Switch,Table,Space,Alert,message} from "antd";
import {SupabaseClient} from "@supabase/supabase-js";
type Ad={id:number;title:string;body:string|null;image_url:string|null;enabled:boolean;display_mode:string;start_at:string|null;end_at:string|null;week_start:number;week_end:number;sort_index:number};
const fallback:Ad={id:-1,title:"مرحبًا بك في Flexy Mini",body:"الفليكسي وإيدوم والبطاقات الرقمية في مكان واحد",image_url:null,enabled:true,display_mode:"always",start_at:null,end_at:null,week_start:4,week_end:5,sort_index:0};
const days=["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
function shown(a:Ad,d:Date){if(!a.enabled)return false;if(a.display_mode==="period")return (!a.start_at||d>=new Date(a.start_at))&&(!a.end_at||d<=new Date(a.end_at));if(a.display_mode==="weekly"){const n=d.getDay();return a.week_start<=a.week_end?n>=a.week_start&&n<=a.week_end:n>=a.week_start||n<=a.week_end;}return true;}
export default function AdSystem({db,admin=false}:{db:SupabaseClient;admin?:boolean}){
 const [ads,setAds]=useState<Ad[]>([]),[now,setNow]=useState(new Date()),[idx,setIdx]=useState(0),[edit,setEdit]=useState<number|null>(null),[error,setError]=useState("");
 const [form]=Form.useForm();
 const [uploading,setUploading]=useState(false);
 const [preview,setPreview]=useState("");
 const uploadImage=async(file:File)=>{if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)||file.size>5*1024*1024){message.error("اختر صورة بحجم أقل من 5 ميغابايت");return;}setUploading(true);try{const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"} as Record<string,string>)[file.type];const path=crypto.randomUUID()+"."+ext;const r=await db.storage.from("flexy-mini-ads").upload(path,file,{contentType:file.type,upsert:false});if(r.error)throw r.error;const publicUrl=db.storage.from("flexy-mini-ads").getPublicUrl(path).data.publicUrl;form.setFieldValue("image_url",publicUrl);setPreview(publicUrl);message.success("تم رفع الصورة");}catch{message.error("تعذر رفع الصورة. يجب تجهيز مساحة تخزين إعلانات Flexy Mini أولًا.");}finally{setUploading(false);}};
 const reload=async()=>{const r=await db.from("flexy_mini_ads").select("*").order("sort_index");if(r.error)setError("قاعدة بيانات الإعلانات غير مجهزة بعد");else{setAds((r.data||[]) as Ad[]);setError("");}};
 useEffect(()=>{void reload();const t=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(t);},[]);
 const slides=ads.filter(a=>shown(a,now));if(!slides.length)slides.push(fallback);
 useEffect(()=>{if(slides.length<2)return;const t=setInterval(()=>setIdx(i=>(i+1)%slides.length),5000);return()=>clearInterval(t);},[slides.map(a=>a.id).join(",")]);
 const current=slides[idx%slides.length];
 const save=async(v:any)=>{if(!v.title?.trim()&&!v.image_url){message.error("أدخل نصًا أو ارفع صورة للإعلان");return;}const data={...v,title:v.title?.trim()||"إعلان مصور",body:v.body||"",image_url:v.image_url||null,sort_index:Number(v.sort_index)||0,start_at:v.display_mode==="period"&&v.start_at?new Date(v.start_at).toISOString():null,end_at:v.display_mode==="period"&&v.end_at?new Date(v.end_at).toISOString():null};const r=edit===null?await db.from("flexy_mini_ads").insert(data):await db.from("flexy_mini_ads").update(data).eq("id",edit);if(r.error){message.error(r.error.message);return;}message.success("تم الحفظ");setEdit(null);setPreview("");form.resetFields();await reload();};
 return <Space direction="vertical" style={{width:"100%"}} size="large">
 <div style={{borderRadius:18,background:"#243b78",color:"white",padding:24,minHeight:190,display:"flex",flexDirection:"column",justifyContent:"center",gap:12}}>
 {current.image_url&&<img src={current.image_url} alt={current.title} style={{maxHeight:240,width:"100%",objectFit:"contain"}}/>}
 <strong style={{fontSize:25}}>{current.title}</strong><span>{current.body}</span>
 {slides.length>1&&<Space style={{justifyContent:"space-between"}}><Button onClick={()=>setIdx(i=>(i+slides.length-1)%slides.length)}>❯</Button><span>{idx%slides.length+1} / {slides.length}</span><Button onClick={()=>setIdx(i=>(i+1)%slides.length)}>❮</Button></Space>}
 </div>
 {admin&&<Card title="إدارة الإعلانات">{error&&<Alert type="warning" message={error} style={{marginBottom:12}}/>}
 <Form form={form} layout="vertical" initialValues={{enabled:true,display_mode:"always",week_start:4,week_end:5,sort_index:0}} onFinish={save}>
 <Form.Item name="title" label="عنوان الإعلان (اختياري إذا توجد صورة)"><Input/></Form.Item>
 <Form.Item name="body" label="النص"><Input.TextArea/></Form.Item>
 <Form.Item name="image_url" label="صورة الإعلان (اختيارية)" hidden><Input/></Form.Item>
 <Space direction="vertical" style={{width:"100%"}}><input aria-label="تحميل صورة الإعلان" type="file" accept="image/*" disabled={uploading} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadImage(file);e.target.value="";}}/>{uploading&&<span>جاري رفع الصورة...</span>}{preview&&<><img src={preview} alt="معاينة الإعلان" style={{maxWidth:"100%",maxHeight:190,borderRadius:12}}/><Button onClick={()=>{setPreview("");form.setFieldValue("image_url",null)}}>إزالة الصورة من الإعلان</Button></>}</Space>
 <Form.Item name="enabled" label="ظاهر" valuePropName="checked"><Switch/></Form.Item>
 <Form.Item name="display_mode" label="الجدولة"><Select options={[{value:"always",label:"دائم"},{value:"period",label:"فترة محددة"},{value:"weekly",label:"أسبوعي"}]}/></Form.Item>
 <Form.Item noStyle shouldUpdate>{({getFieldValue})=>getFieldValue("display_mode")==="period"?<Space wrap><Form.Item name="start_at" label="البداية"><Input type="datetime-local"/></Form.Item><Form.Item name="end_at" label="النهاية"><Input type="datetime-local"/></Form.Item></Space>:getFieldValue("display_mode")==="weekly"?<Space wrap><Form.Item name="week_start" label="من"><Select style={{width:130}} options={days.map((label,value)=>({label,value}))}/></Form.Item><Form.Item name="week_end" label="إلى"><Select style={{width:130}} options={days.map((label,value)=>({label,value}))}/></Form.Item></Space>:null}</Form.Item>
 <Form.Item name="sort_index" label="الترتيب"><Input type="number"/></Form.Item>
 <Space><Button type="primary" htmlType="submit">{edit===null?"إضافة إعلان":"حفظ"}</Button>{edit!==null&&<Button onClick={()=>{setEdit(null);form.resetFields()}}>إلغاء</Button>}</Space>
 </Form>
 <Table style={{marginTop:16}} rowKey="id" dataSource={ads} pagination={{pageSize:8}} scroll={{x:460}} columns={[{title:"الإعلان",dataIndex:"title"},{title:"الحالة",render:(_,a:Ad)=>shown(a,now)?"ظاهر":a.enabled?"مجدول":"مخفي"},{title:"الإجراءات",render:(_,a:Ad)=><Space><Button size="small" onClick={()=>{setEdit(a.id);setPreview(a.image_url||"");form.setFieldsValue({...a,start_at:a.start_at?.slice(0,16),end_at:a.end_at?.slice(0,16)})}}>تعديل</Button><Button size="small" onClick={async()=>{const r=await db.from("flexy_mini_ads").update({enabled:!a.enabled}).eq("id",a.id);if(r.error)message.error(r.error.message);else await reload();}}>{a.enabled?"إخفاء":"إظهار"}</Button></Space>}]}/>
 </Card>}
 </Space>;
}
