import React,{useEffect,useState,useRef} from "react";
import {Button,Card,Form,Input,Select,Switch,Table,Space,Alert,message} from "antd";
import {SupabaseClient} from "@supabase/supabase-js";
type Ad={is_fallback:boolean;id:number;title:string;body:string|null;image_url:string|null;link_url:string|null;content_display_mode:string;enabled:boolean;display_mode:string;start_at:string|null;end_at:string|null;week_start:number;week_end:number;sort_index:number};
const days=["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
function shown(a:Ad,d:Date){if(!a.enabled)return false;if(a.display_mode==="period")return (!a.start_at||d>=new Date(a.start_at))&&(!a.end_at||d<=new Date(a.end_at));if(a.display_mode==="weekly"){const n=d.getDay();return a.week_start<=a.week_end?n>=a.week_start&&n<=a.week_end:n>=a.week_start||n<=a.week_end;}return true;}
export default function AdSystem({db,admin=false}:{db:SupabaseClient;admin?:boolean}){
 const [ads,setAds]=useState<Ad[]>([]),[now,setNow]=useState(new Date()),[idx,setIdx]=useState(0),[edit,setEdit]=useState<number|null>(null),[error,setError]=useState("");
 const [form]=Form.useForm();
 const editorRef=useRef<HTMLDivElement|null>(null);
 const [uploading,setUploading]=useState(false);
 const [preview,setPreview]=useState("");
 const [slideError,setSlideError]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [savingId,setSavingId]=useState<number|null>(null);
 const uploadImage=async(file:File)=>{if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)||file.size>5*1024*1024){message.error("اختر صورة بحجم أقل من 5 ميغابايت");return;}setUploading(true);try{const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"} as Record<string,string>)[file.type];const path=crypto.randomUUID()+"."+ext;const r=await db.storage.from("flexy-mini-ads").upload(path,file,{contentType:file.type,upsert:false});if(r.error)throw r.error;const publicUrl=db.storage.from("flexy-mini-ads").getPublicUrl(path).data.publicUrl;form.setFieldValue("image_url",publicUrl);setPreview(publicUrl);message.success("تم رفع الصورة");}catch{message.error("تعذر رفع الصورة. يجب تجهيز مساحة تخزين إعلانات Flexy Mini أولًا.");}finally{setUploading(false);}};
 const reload=async()=>{const r=await db.from("flexy_mini_ads").select("*").order("sort_index");if(r.error)setError("تعذر تحميل الإعلانات");else{setAds((r.data||[]) as Ad[]);setError("");}setLoaded(true);};
 useEffect(()=>{void reload();const t=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(t);},[]);
 const ordinary=ads.filter(a=>!a.is_fallback&&shown(a,now));
 const savedFallback=ads.find(a=>a.is_fallback);
 const slides=ordinary.length?ordinary:(savedFallback&&shown(savedFallback,now)?[savedFallback]:[]);
 useEffect(()=>{if(slides.length<2)return;const t=setInterval(()=>setIdx(i=>(i+1)%slides.length),5000);return()=>clearInterval(t);},[slides.map(a=>a.id).join(",")]);
 const current=slides.length?slides[idx%slides.length]:null;
 useEffect(()=>setSlideError(false),[current?.id,current?.image_url]);
 const mode=current?.content_display_mode||"auto";
 const imageVisible=!!current?.image_url&&!slideError&&mode!=="text";
 const textVisible=mode==="text"||mode==="both"||!imageVisible;
 const toggleStatus=async(a:Ad)=>{if(savingId!==null)return;setSavingId(a.id);const next=!a.enabled;setAds(old=>old.map(x=>x.id===a.id?{...x,enabled:next}:x));const r=await db.from("flexy_mini_ads").update({enabled:next}).eq("id",a.id).select("id,enabled").single();if(r.error){setAds(old=>old.map(x=>x.id===a.id?{...x,enabled:a.enabled}:x));message.error("تعذر تغيير الحالة: "+r.error.message);}else{setAds(old=>old.map(x=>x.id===a.id?{...x,enabled:r.data.enabled}:x));message.success(r.data.enabled?"الإعلان ظاهر":"الإعلان مخفي");}setSavingId(null);};
 const startEdit=(a:Ad)=>{setEdit(a.id);setPreview(a.image_url||"");form.setFieldsValue({...a,start_at:a.start_at?.slice(0,16),end_at:a.end_at?.slice(0,16)});requestAnimationFrame(()=>editorRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));};
 const save=async(v:any)=>{if(!v.body?.trim()&&!v.image_url){message.error("أدخل نص الإعلان أو ارفع صورة");return;}if(v.content_display_mode==="text"&&!v.body?.trim()){message.error("وضع النص فقط يحتاج نص الإعلان");return;}if(v.content_display_mode==="image"&&!v.image_url){message.error("وضع الصورة فقط يحتاج صورة");return;}const link=(v.link_url||"").trim();if(link&&!/^https:\/\/[^\s]+$/i.test(link)){message.error("الرابط يجب أن يبدأ بـ https://");return;}const title=v.title?.trim()||null;const data={...v,content_display_mode:v.content_display_mode||"auto",link_url:link||null,title:title||"إعلان جديد",body:v.body||"",image_url:v.image_url||null,sort_index:Number(v.sort_index)||0,start_at:v.display_mode==="period"&&v.start_at?new Date(v.start_at).toISOString():null,end_at:v.display_mode==="period"&&v.end_at?new Date(v.end_at).toISOString():null};const r=edit===null?await db.from("flexy_mini_ads").insert(data).select("id").single():await db.from("flexy_mini_ads").update(data).eq("id",edit).select("id").single();if(r.error){message.error(r.error.message);return;}if(!title&&r.data?.id){const name="إعلان #"+r.data.id;const named=await db.from("flexy_mini_ads").update({title:name}).eq("id",r.data.id);if(named.error)message.warning("حُفظ الإعلان لكن تعذر تحديث اسمه التلقائي");}message.success("تم الحفظ");setEdit(null);setPreview("");form.resetFields();await reload();};
 return <Space direction="vertical" style={{width:"100%"}} size="large">
 {!loaded?<div style={{minHeight:190}} aria-label="جاري تحميل الإعلانات"/>:current?<div style={{borderRadius:18,background:imageVisible?"transparent":"#243b78",color:"white",padding:imageVisible?0:24,minHeight:imageVisible?0:190,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"center",gap:12,paddingBottom:imageVisible?0:slides.length>1?76:24}}>
 {imageVisible?(current?.link_url?<a href={current.link_url} target="_blank" rel="noopener noreferrer" aria-label={"فتح رابط "+current?.title} style={{display:"block",width:"100%"}}><img src={current?.image_url||undefined} alt={current.title} onError={()=>setSlideError(true)} style={{width:"100%",height:"auto",display:"block",cursor:"pointer"}}/></a>:<img src={current.image_url||undefined} alt={current.title} onError={()=>setSlideError(true)} style={{width:"100%",height:"auto",display:"block"}}/> ):null}
 {textVisible&&<div style={{padding:imageVisible?16:0,background:imageVisible?"#243b78":"transparent",color:"white"}}><strong style={{fontSize:25}}>{current?.body||"مرحبًا بك"}</strong>{current.link_url&&!imageVisible&&<div><a href={current.link_url} target="_blank" rel="noopener noreferrer" style={{color:"white",textDecoration:"underline"}}>افتح الرابط ↗</a></div>}</div>}
 {slides.length>1&&<div dir="ltr" style={{position:"absolute",insetInline:12,bottom:12,display:"grid",gridTemplateColumns:"48px 1fr 48px",alignItems:"center",gap:8,zIndex:2,pointerEvents:"none"}}><Button aria-label="الإعلان السابق" onClick={()=>setIdx(i=>(i+slides.length-1)%slides.length)} style={{pointerEvents:"auto",height:44,width:44,fontSize:24,fontWeight:700,padding:0}}>‹</Button><span style={{justifySelf:"center",background:"#0009",color:"white",padding:"5px 12px",borderRadius:20,fontWeight:700,fontSize:16}}>{idx%slides.length+1} / {slides.length}</span><Button aria-label="الإعلان التالي" onClick={()=>setIdx(i=>(i+1)%slides.length)} style={{pointerEvents:"auto",height:44,width:44,fontSize:24,fontWeight:700,padding:0}}>›</Button></div>}
 </div>:null}
 {admin&&<div ref={editorRef}><Card title={edit===null?"إدارة الإعلانات":"تعديل الإعلان #"+edit}>{error&&<Alert type="warning" message={error} style={{marginBottom:12}}/>}
 <Form form={form} layout="vertical" initialValues={{enabled:true,display_mode:"always",content_display_mode:"auto",week_start:4,week_end:5,sort_index:0}} onFinish={save}>
 <Form.Item name="title" label="اسم داخلي للإعلان (اختياري، لا يظهر للزبون)"><Input/></Form.Item>
 <Form.Item name="body" label="نص الإعلان"><Input.TextArea/></Form.Item>
 <Form.Item name="content_display_mode" label="طريقة عرض محتوى الإعلان"><Select options={[{value:"auto",label:"تلقائي: الصورة إن وجدت وإلا النص"},{value:"image",label:"الصورة فقط"},{value:"text",label:"النص فقط"},{value:"both",label:"الصورة مع النص"}]}/></Form.Item>
 <Form.Item name="link_url" label="رابط الإعلان عند الضغط على الصورة (اختياري)"><Input type="url" dir="ltr" placeholder="https://example.com"/></Form.Item>
 <Form.Item name="image_url" label="صورة الإعلان (اختيارية)" hidden><Input/></Form.Item>
 <Space direction="vertical" style={{width:"100%"}}><input aria-label="تحميل صورة الإعلان" type="file" accept="image/*" disabled={uploading} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadImage(file);e.target.value="";}}/>{uploading&&<span>جاري رفع الصورة...</span>}{preview&&<><img src={preview} alt="معاينة الإعلان" style={{maxWidth:"100%",maxHeight:190,borderRadius:12}}/><Button onClick={()=>{setPreview("");form.setFieldValue("image_url",null)}}>إزالة الصورة من الإعلان</Button></>}</Space>
 <Form.Item name="enabled" label="ظاهر" valuePropName="checked"><Switch/></Form.Item>
 <Form.Item name="display_mode" label="الجدولة"><Select options={[{value:"always",label:"دائم"},{value:"period",label:"فترة محددة"},{value:"weekly",label:"أسبوعي"}]}/></Form.Item>
 <Form.Item noStyle shouldUpdate>{({getFieldValue})=>getFieldValue("display_mode")==="period"?<Space wrap><Form.Item name="start_at" label="البداية"><Input type="datetime-local"/></Form.Item><Form.Item name="end_at" label="النهاية"><Input type="datetime-local"/></Form.Item></Space>:getFieldValue("display_mode")==="weekly"?<Space wrap><Form.Item name="week_start" label="من"><Select style={{width:130}} options={days.map((label,value)=>({label,value}))}/></Form.Item><Form.Item name="week_end" label="إلى"><Select style={{width:130}} options={days.map((label,value)=>({label,value}))}/></Form.Item></Space>:null}</Form.Item>
 <Form.Item name="sort_index" label="الترتيب"><Input type="number"/></Form.Item>
 <Space><Button type="primary" htmlType="submit">{edit===null?"إضافة إعلان":"حفظ"}</Button>{edit!==null&&<Button onClick={()=>{setEdit(null);form.resetFields()}}>إلغاء</Button>}</Space>
 </Form>
 <Table style={{marginTop:16}} rowKey="id" dataSource={ads} pagination={{pageSize:8}} scroll={{x:460}} columns={[
 {title:"الإعلان",render:(_,a:Ad)=><span>{a.title}{a.is_fallback?" (افتراضي)":""}</span>},
 {title:"الحالة",render:(_,a:Ad)=><Button type="link" size="small" loading={savingId===a.id} disabled={savingId!==null&&savingId!==a.id} onClick={()=>void toggleStatus(a)} aria-label={"تغيير حالة "+a.title} style={{fontWeight:700,color:a.enabled?"#1677ff":"#777"}}>{a.enabled?(a.is_fallback?"احتياطي · مفعّل":shown(a,now)?"ظاهر":"مجدول"):"مخفي"}</Button>},
 {title:"الإجراءات",render:(_,a:Ad)=><Button size="small" onClick={()=>startEdit(a)}>تعديل</Button>}
 ]}/>
 </Card></div>}
 </Space>;
}
