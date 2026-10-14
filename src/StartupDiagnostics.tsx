import { useEffect, useState } from "react";
import { Alert, Button, Card, Descriptions, Space, Table, Typography } from "antd";

type Sample={at:string;kind:string;ms?:number;detail?:string};
const KEY="flexy_mini_boot_diagnostics_v1";
function read():Sample[]{
 try{const raw=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(raw)?raw.slice(-30):[];}catch{return [];}
}
export default function StartupDiagnostics(){
 const [rows,setRows]=useState<Sample[]>(read);
 const [navigation,setNavigation]=useState<PerformanceNavigationTiming|null>(null);
 useEffect(()=>{
  const update=()=>{setRows(read());setNavigation(performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming||null);};
  update();const timer=setInterval(update,3000);return()=>clearInterval(timer);
 },[]);
 const latest=rows.filter(x=>x.kind==="app-mounted").slice(-1)[0];
 const resources=performance.getEntriesByType("resource").filter((entry)=>/\.(js|css)(\?|$)/.test(entry.name)).map((entry)=>({kind:entry.name.split("/").pop()?.split("?")[0]||"asset",ms:Math.round(entry.duration),start:Math.round(entry.startTime),bytes:(entry as PerformanceResourceTiming).transferSize||0})).sort((a,b)=>b.ms-a.ms).slice(0,12);
 const report=JSON.stringify({version:2,recordedAt:new Date().toISOString(),slowAssets:resources,navigation:navigation?{
  dns:Math.round(navigation.domainLookupEnd-navigation.domainLookupStart),
  connection:Math.round(navigation.connectEnd-navigation.connectStart),
  response:Math.round(navigation.responseEnd-navigation.requestStart),
  domReady:Math.round(navigation.domContentLoadedEventEnd),
  load:Math.round(navigation.loadEventEnd)
 }:null,events:rows},null,2);
 return <Card title="قياس سرعة التشغيل — على هذا الجهاز فقط" size="small">
  <Space direction="vertical" style={{width:"100%"}}>
   <Alert type="info" showIcon message="القياس محلي. لا يجمع كلمات مرور أو PIN أو أرقام هواتف، ولا يرسل أي بيانات تلقائيًا."/>
   <Descriptions bordered column={1} size="small">
    <Descriptions.Item label="ظهور الواجهة">{latest?.ms!=null?latest.ms+" مللي ثانية":"لم يسجل بعد"}</Descriptions.Item>
    <Descriptions.Item label="تحميل HTML">{navigation?Math.round(navigation.responseEnd-navigation.requestStart)+" مللي ثانية":"غير متاح"}</Descriptions.Item>
    <Descriptions.Item label="اكتمال تحميل الصفحة">{navigation?.loadEventEnd?Math.round(navigation.loadEventEnd)+" مللي ثانية":"غير متاح"}</Descriptions.Item>
    <Descriptions.Item label="عدد الأحداث">{rows.length}</Descriptions.Item>
   </Descriptions>
   <Typography.Text strong>أبطأ ملفات JavaScript وCSS</Typography.Text>
   <Table size="small" rowKey={(item)=>item.kind} pagination={{pageSize:6}} scroll={{x:360}} dataSource={resources} columns={[{title:"الملف",dataIndex:"kind",ellipsis:true},{title:"المدة ms",dataIndex:"ms"},{title:"البدء ms",dataIndex:"start"},{title:"بايت من الشبكة",dataIndex:"bytes"}]}/>
   <Table size="small" rowKey={(_,i)=>String(i)} pagination={{pageSize:8}} scroll={{x:400}}
    dataSource={[...rows].reverse()} columns={[
     {title:"الوقت",dataIndex:"at",render:(v:string)=>new Date(v).toLocaleTimeString("ar-DZ")},
     {title:"الحدث",dataIndex:"kind"},
     {title:"المدة ms",dataIndex:"ms"},
     {title:"التفاصيل",dataIndex:"detail",ellipsis:true}
    ]}/>
   <Space wrap>
    <Button onClick={()=>{void navigator.clipboard.writeText(report);}}>نسخ تقرير الأداء</Button>
    <Button onClick={()=>{localStorage.removeItem(KEY);setRows([]);}}>مسح القياسات فقط</Button>
    <Button onClick={()=>setRows(read())}>تحديث</Button>
   </Space>
   <Typography.Text type="secondary">احتفاظ بآخر 30 حدثًا فقط. مسح القياسات لا يمس حسابك أو بياناتك.</Typography.Text>
  </Space>
 </Card>;
}
