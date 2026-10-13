import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {Alert,Button,Card,ConfigProvider,Input,Select,Space,Tag,Typography,message} from "antd";
import {ExperimentOutlined,DeleteOutlined,ReloadOutlined,PhoneOutlined} from "@ant-design/icons";
import type {SupabaseClient} from "@supabase/supabase-js";
import FlexyServicePage from "./FlexyServicePage";
import {newDemoPhone,resetDemo,getDemoGroup,setDemoGroup,setDemoOutcome,currentDemoOutcome} from "./demo/mockDb";
import {enableLabMocking,demoMswClient} from "./demo/mswBrowser";
import type {DemoGroup,DemoOutcome} from "./demo/mockDb";
import "antd/dist/reset.css";
import "./style.css";

const groups:{label:string;value:DemoGroup}[]=[
  {value:"PIXX",label:"PixX"},{value:"REVOLUTION",label:"Revolution"},{value:"SAMA",label:"Sama Mix / Talk / Net"},
];
const outcomes:{label:string;value:DemoOutcome}[]=[
  {value:"success",label:"نجاح وهمي"},{value:"failed",label:"فشل وهمي"},{value:"review",label:"مراجعة / نتيجة غير مؤكدة"},
];
function Lab(){
  // The user never has to type a number: a fresh fake test recipient is generated at entry.
  const [phone,setPhone]=useState(newDemoPhone);
  const [version,setVersion]=useState(0);
  const [selectedGroup,setSelectedGroup]=useState<DemoGroup>(()=>getDemoGroup(phone));
  const [outcome,setOutcome]=useState<DemoOutcome>(()=>currentDemoOutcome());
  const restart=(p=phone)=>{
    setPhone(p);setSelectedGroup(getDemoGroup(p));setVersion(v=>v+1);
  };
  const generate=()=>{
    const p=newDemoPhone();restart(p);message.info("رقم جديد واستكشاف عروض وهمي تلقائي");
  };
  const updatePhone=(p:string)=>{
    setPhone(p);
    if(/^0[5-7]\d{8}$/.test(p))setSelectedGroup(getDemoGroup(p));
  };
  return <ConfigProvider direction="rtl">
    <div style={{maxWidth:920,margin:"0 auto",padding:"14px 12px 72px"}}>
      <Alert showIcon type="warning" style={{marginBottom:12}}
        message={<b>مختبر Flexy Mini — محاكاة معزولة 100%</b>}
        description="لا يوجد اتصال بـSupabase أو Station Connect أو مودم. جميع الأرقام والعمليات والنتائج في هذا المختبر وهمية وتُحفظ محليًا في هذا المتصفح فقط."
      />
      <Card title={<Space><ExperimentOutlined/> إعدادات سيناريو الاختبار</Space>}
        style={{marginBottom:14}} size="small">
        <Space direction="vertical" style={{width:"100%"}} size="middle">
          <Space wrap>
            <Tag color="blue">نفس مكوّن FlexyServicePage الحقيقي</Tag>
            <Tag>بيانات تجريبية — لقطة كتالوج 13 أكتوبر</Tag>
          </Space>
          <div>
            <Typography.Text strong>رقم التجربة</Typography.Text>
            <Space.Compact block style={{marginTop:6}}>
              <Input dir="ltr" inputMode="numeric" placeholder="05XXXXXXXX" value={phone}
                maxLength={13} onChange={e=>updatePhone(e.target.value.replace(/\s/g,""))}
                prefix={<PhoneOutlined/>}/>
              <Button type="primary" onClick={()=>restart()}>إعادة البحث</Button>
              <Button onClick={generate} icon={<ReloadOutlined/>}>رقم جديد + عروض</Button>
            </Space.Compact>
            <Typography.Text type="secondary" style={{fontSize:12}}>الرقم يُولد تلقائيًا عند فتح المختبر أو الضغط على «رقم جديد + عروض». الكتابة اليدوية اختيارية فقط.</Typography.Text>
          </div>
          <div>
            <Typography.Text strong>نوع عروض الرقم التجريبي</Typography.Text>
            <Select style={{width:"100%",marginTop:6}} value={selectedGroup}
              options={groups}
              onChange={g=>{
                if(!/^0[5-7]\d{8}$/.test(phone)){message.warning("أدخل رقم تجريبي صحيحًا أولًا");return;}
                setDemoGroup(phone,g);setSelectedGroup(g);restart(phone);
              }}/>
          </div>
          <div>
            <Typography.Text strong>نتيجة الإرسال التجريبي</Typography.Text>
            <Select style={{width:"100%",marginTop:6}} value={outcome} options={outcomes}
              onChange={o=>{setDemoOutcome(o);setOutcome(o);message.info("تم تغيير نتيجة العمليات الوهمية القادمة فقط")}}/>
          </div>
          <Space wrap>
            <Button onClick={()=>restart()} icon={<ReloadOutlined/>}>إعادة اختبار نفس الرقم</Button>
            <Button danger icon={<DeleteOutlined/>} onClick={()=>{
              resetDemo();setOutcome("success");restart();message.success("تم مسح بيانات المحاكاة المحلية");
            }}>مسح التجارب</Button>
          </Space>
        </Space>
      </Card>
      <Typography.Title level={4} style={{marginTop:0}}>صفحة الفليكسي الأصلية — وضع المحاكاة</Typography.Title>
      <Typography.Paragraph type="secondary" style={{fontSize:13}}>
        عند فتح المختبر يُولد رقم وتُفتح عروضه تلقائيًا. اضغط «رقم جديد + عروض» للتجربة التالية دون كتابة. كل الاستكشاف والإرسال وهمي ومحفوظ محليًا.
      </Typography.Paragraph>
      <FlexyServicePage key={version} db={demoMswClient as unknown as SupabaseClient}
        isCustomer={false} simulation autoOpenOffers initialPhone={phone} onPhoneChange={updatePhone}/>
    </div>
  </ConfigProvider>;
}
// Mount ONLY after the MSW worker is ready. No fail-open fallback.
const root=createRoot(document.getElementById("root")!);
void enableLabMocking().then(()=>{
  const nativeFetch=window.fetch.bind(window);
  window.fetch=((input:RequestInfo|URL,init?:RequestInit)=>{
    const dest=new URL(input instanceof Request?input.url:String(input),window.location.href);
    if(dest.origin!==window.location.origin) {
      return Promise.reject(new Error("المختبر يمنع الاتصال بخوادم خارجية"));
    }
    return nativeFetch(input,init);
  }) as typeof fetch;
  root.render(<React.StrictMode><Lab/></React.StrictMode>);
}).catch(error=>{
  root.render(<ConfigProvider direction="rtl"><Alert type="error" showIcon
    message="تعذر بدء محاكاة MSW بأمان"
    description={(error instanceof Error?error.message:String(error))+
      " — لم نفتح صفحة فليكسي ولم نتصل بالشبكة الحقيقية."}/></ConfigProvider>);
});
