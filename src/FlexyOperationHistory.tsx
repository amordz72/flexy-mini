import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Space, Table, Tag, Typography } from "antd";
import type { SupabaseClient } from "@supabase/supabase-js";

type ResponseStep = { sequence: number; action: string; status: string; response: string; error_code: string | null; created_at: string };
type Operation = { job_uuid: string; phone: string; service: string; offer_name: string; amount: number | null;
  status: string; result_code: string | null; result_text: string; created_at: string; completed_at: string | null;
  responses: ResponseStep[]; total_count: number };
const statusNames: Record<string,string> = {
 queued:"في الطابور",claimed:"قيد التنفيذ",success:"ناجحة",failed:"فشلت",
 review:"نتيجة الشبكة غير مؤكدة",prepared:"لم يُرسل",unavailable:"غير متاحة"
};
const state = (value:string) => <Tag color={value==="prepared"?"default":
 value==="success"?"green":value==="failed"||value==="review"?"red":"orange"}>{statusNames[value]||value}</Tag>;
const response = (value:string) => <Typography.Text style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{value||"—"}</Typography.Text>;
const date = (value:string) => new Date(value).toLocaleString("ar-DZ");

export default function FlexyOperationHistory({db,refreshToken=0}:{db:SupabaseClient;refreshToken?:number}){
 const [rows,setRows]=useState<Operation[]>([]);
 const [page,setPage]=useState(1);
 const [total,setTotal]=useState(0);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const sequence=useRef(0);
 const load=useCallback(async()=>{
  const request=++sequence.current;setLoading(true);
  try{
   const result=await db.rpc("flexy_mini_admin_recent_operations",{p_limit:10,p_offset:(page-1)*10});
   if(request!==sequence.current)return;
   if(result.error)throw result.error;
   const data=(Array.isArray(result.data)?result.data:[]) as Operation[];
   setRows(data);setTotal(Number(data[0]?.total_count||0));setError("");
  }catch{if(request===sequence.current)setError("تعذر تحميل سجل العمليات.");}
  finally{if(request===sequence.current)setLoading(false);}
 },[db,page]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load,refreshToken]);
 return <section aria-label="آخر عمليات الفليكسي">
  <Space style={{width:"100%",justifyContent:"space-between",marginBottom:12}}>
   <Typography.Text strong>آخر العمليات</Typography.Text>
   <Button loading={loading} onClick={()=>void load()}>تحديث</Button>
  </Space>
  {error&&<Alert type="error" message={error} style={{marginBottom:12}}/>}
  <Table<Operation> rowKey="job_uuid" size="small" bordered loading={loading} dataSource={rows}
   scroll={{x:1200}} locale={{emptyText:"لا توجد عمليات"}}
   pagination={{current:page,pageSize:10,total,showSizeChanger:false,onChange:setPage}}
   columns={[
    {title:"التاريخ",dataIndex:"created_at",width:165,render:date},
    {title:"الرقم",dataIndex:"phone",width:130,render:(v:string)=><bdi dir="ltr">{v||"—"}</bdi>},
    {title:"الخدمة",dataIndex:"service",width:120},
    {title:"اسم العرض",dataIndex:"offer_name",width:160},
    {title:"المبلغ",dataIndex:"amount",width:100,render:(v:number|null)=>v===null?"—":v.toLocaleString("en-US")+" دج"},
    {title:"الحالة",dataIndex:"status",width:125,render:state},
    {title:"رد الشبكة",dataIndex:"result_text",width:400,render:response},
    {title:"رمز النتيجة",dataIndex:"result_code",width:190,render:(v:string|null)=><bdi dir="ltr">{v||"—"}</bdi>}
   ]}
   expandable={{rowExpandable:r=>r.responses.length>0,expandedRowRender:r=><>
    <Typography.Text copyable={{text:r.job_uuid}}>مرجع العملية: {r.job_uuid}</Typography.Text>
    <Table<ResponseStep> size="small" rowKey="sequence" dataSource={r.responses} pagination={false}
     scroll={{x:700}} columns={[
      {title:"الخطوة",dataIndex:"sequence",width:70},
      {title:"الأمر",dataIndex:"action",width:140},
      {title:"الحالة",dataIndex:"status",width:120,render:state},
      {title:"رد الشبكة الخام",dataIndex:"response",render:response},
      {title:"الوقت",dataIndex:"created_at",width:160,render:date}
     ]}/>
   </>}}
  />
 </section>;
}
