import React,{useEffect,useState} from "react";
import {Alert,Button,Card,Form,Input,InputNumber,Switch,Table,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";
type Credit={user_id:string;party_id:number;enabled:boolean;credit_limit:number;debt:number;wallet_balance:number};
export default function CreditAdmin({db}:{db:SupabaseClient}){
 const [form]=Form.useForm();const [rows,setRows]=useState<Credit[]>([]);const [busy,setBusy]=useState(false);
 const load=async()=>{const r=await db.from("flexy_mini_credit_accounts").select("user_id,party_id,enabled,credit_limit,debt,wallet_balance").order("updated_at",{ascending:false});if(r.error)message.error(r.error.message);else setRows((r.data||[]) as Credit[]);};
 useEffect(()=>{void load();},[]);
 const save=async(v:any)=>{setBusy(true);const r=await db.rpc("flexy_mini_admin_set_credit",{p_user_id:v.user_id.trim(),p_party_id:v.party_id,p_enabled:!!v.enabled,p_limit:v.credit_limit});setBusy(false);if(r.error)message.error("تعذر الحفظ: "+r.error.message);else{message.success("تم حفظ صلاحية وسقف الدين");form.resetFields();void load();}};
 return <Card title="الشحن الذاتي بالدَّين — صلاحيات العملاء">
 <Alert type="warning" showIcon style={{marginBottom:16}} message="هذه محفظة ائتمان داخلية تجريبية، وليست تحويل أموال حقيقيًا. لا تفعل حساب عميل قبل التأكد من هويته."/>
 <Form form={form} layout="vertical" onFinish={save} initialValues={{enabled:false,credit_limit:10000}}>
 <Form.Item label="معرّف دخول العميل (UUID)" name="user_id" rules={[{required:true}]}><Input dir="ltr" placeholder="معرّف مستخدم Supabase Auth"/></Form.Item>
 <Form.Item label="رقم العميل في الماستر" name="party_id" rules={[{required:true}]}><InputNumber min={1} precision={0} style={{width:"100%"}}/></Form.Item>
 <Form.Item label="سقف الدين بالدينار (مضاعفات 5,000)" name="credit_limit" rules={[{required:true}, {validator:async(_,v)=>{if(v<0||v%5000!==0)throw Error("السقف لازم يكون مضاعفات 5,000");}}]}><InputNumber min={0} step={5000} precision={0} style={{width:"100%"}}/></Form.Item>
 <Form.Item label="السماح بالشحن الذاتي" name="enabled" valuePropName="checked"><Switch/></Form.Item>
 <Button htmlType="submit" type="primary" loading={busy}>حفظ الصلاحية والسقف</Button>
 </Form>
 <Typography.Title level={5} style={{marginTop:24}}>الحسابات المربوطة</Typography.Title>
 <Table rowKey="user_id" size="small" dataSource={rows} scroll={{x:680}} pagination={{pageSize:10}} columns={[
 {title:"العميل",dataIndex:"party_id"},
 {title:"الحالة",render:(_,r:Credit)=><Tag color={r.enabled?"green":"default"}>{r.enabled?"مسموح":"موقوف"}</Tag>},
 {title:"السقف",dataIndex:"credit_limit"},
 {title:"الدين",dataIndex:"debt"},
 {title:"المتاح",render:(_,r:Credit)=>Math.max(0,r.credit_limit-r.debt).toLocaleString("en-US")},
 {title:"تعديل",render:(_,r:Credit)=><Button size="small" onClick={()=>{form.setFieldsValue(r);window.scrollTo({top:0,behavior:"smooth"});}}>تعديل</Button>}
 ]}/>
 </Card>;
}