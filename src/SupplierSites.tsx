import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Select, Space, Switch, Table, Tag, message } from "antd";
import type { SupabaseClient } from "@supabase/supabase-js";

type Site = {id:string;name:string;base_url:string;integration_kind:"manual"|"api"|"station";enabled:boolean;notes:string};
export default function SupplierSites({db}:{db:SupabaseClient}) {
 const [rows,setRows]=useState<Site[]>([]);
 const [busy,setBusy]=useState(false);
 const [form]=Form.useForm();
 const [editing,setEditing]=useState<string|null>(null);
 const load=async()=>{setBusy(true);const {data,error}=await db.from("flexy_mini_supplier_sites").select("id,name,base_url,integration_kind,enabled,notes").order("name");setBusy(false);if(error)message.error(error.message);else setRows(data||[]);};
 useEffect(()=>{void load();},[db]);
 const save=async(values:Omit<Site,"id">)=>{
  setBusy(true);
  const payload={...values,base_url:values.base_url.trim(),name:values.name.trim(),enabled:values.enabled??false};
  const result=editing?await db.from("flexy_mini_supplier_sites").update(payload).eq("id",editing):await db.from("flexy_mini_supplier_sites").insert(payload);
  setBusy(false);
  if(result.error){message.error(result.error.message);return;}
  message.success("تم الحفظ");setEditing(null);form.resetFields();await load();
 };
 const edit=(row:Site)=>{setEditing(row.id);form.setFieldsValue(row);};
 return <Space direction="vertical" style={{width:"100%"}} size="middle">
  <Alert type="info" showIcon message="سجل مواقع الموردين" description="إضافة الموقع هنا لا تنفذ أي عملية تلقائية. الربط الفعلي يتطلب موصلًا معتمدًا في السيرفر؛ لا نحدث Station Connect من هذه الصفحة."/>
  <Card title={editing?"تعديل الموقع":"إضافة موقع"} extra={editing?<Button onClick={()=>{setEditing(null);form.resetFields();}}>إلغاء التعديل</Button>:null}>
   <Form form={form} layout="vertical" initialValues={{integration_kind:"manual",enabled:false,notes:""}} onFinish={values=>void save(values)}>
    <Form.Item name="name" label="اسم الموقع" rules={[{required:true}]}><Input maxLength={100}/></Form.Item>
    <Form.Item name="base_url" label="رابط HTTPS" rules={[{required:true},{type:"url",message:"أدخل رابطًا صحيحًا يبدأ بـ https:// "},{pattern:/^https:\/\//,message:"HTTPS فقط"}]}><Input dir="ltr" placeholder="https://example.com"/></Form.Item>
    <Form.Item name="integration_kind" label="نوع الربط"><Select options={[{value:"manual",label:"يدوي"},{value:"api",label:"API"},{value:"station",label:"Station Connect"}]}/></Form.Item>
    <Form.Item name="enabled" label="مفعّل" valuePropName="checked"><Switch/></Form.Item>
    <Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2}/></Form.Item>
    <Button htmlType="submit" type="primary" loading={busy}>{editing?"حفظ التعديل":"إضافة الموقع"}</Button>
   </Form>
  </Card>
  <Card title="المواقع المسجلة"><Table rowKey="id" loading={busy} dataSource={rows} pagination={{pageSize:10}} scroll={{x:650}} columns={[
   {title:"الموقع",dataIndex:"name"},
   {title:"الرابط",dataIndex:"base_url",render:(v:string)=><span dir="ltr">{v}</span>},
   {title:"الربط",dataIndex:"integration_kind"},
   {title:"الحالة",dataIndex:"enabled",render:(v:boolean)=><Tag color={v?"green":"default"}>{v?"مفعّل":"معطّل"}</Tag>},
   {title:"إدارة",render:(_:unknown,row:Site)=><Button onClick={()=>edit(row)}>تعديل</Button>}
  ]}/></Card>
 </Space>;
}
