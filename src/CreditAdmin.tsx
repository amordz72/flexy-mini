import {useEffect,useState} from "react";
import {Alert,Button,Card,Empty,Form,InputNumber,Modal,Space,Switch,Table,Tag,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";
type Credit={user_id:string;party_id:number;enabled:boolean;credit_limit:number;debt:number;wallet_balance:number};
type Party={id:number;display_name:string};
export default function CreditAdmin({db}:{db:SupabaseClient}){
 const [form]=Form.useForm();const [rows,setRows]=useState<Credit[]>([]);const [parties,setParties]=useState<Record<number,string>>({});const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [editing,setEditing]=useState<Credit|null>(null);
 const load=async()=>{setLoading(true);const r=await db.from("flexy_mini_credit_accounts").select("user_id,party_id,enabled,credit_limit,debt,wallet_balance").order("updated_at",{ascending:false});setLoading(false);if(r.error){message.error("تعذر جلب الحسابات: "+r.error.message);return;}const data=(r.data||[]) as Credit[];setRows(data);if(data.length){const p=await db.from("money_party_directory").select("id,display_name").in("id",data.map(x=>x.party_id));if(!p.error)setParties(Object.fromEntries(((p.data||[]) as Party[]).map(x=>[x.id,x.display_name])));}};
 useEffect(()=>{void load();},[]);
 const save=async(v:{enabled:boolean;credit_limit:number})=>{if(!editing)return;setBusy(true);const r=await db.rpc("flexy_mini_admin_set_credit",{p_user_id:editing.user_id,p_party_id:editing.party_id,p_enabled:!!v.enabled,p_limit:v.credit_limit});setBusy(false);if(r.error)message.error("تعذر الحفظ: "+r.error.message);else{message.success("تم حفظ الصلاحية والسقف");setEditing(null);void load();}};
 return <Card title="الشحن الذاتي بالدَّين" style={{marginTop:16}}>
 <Table rowKey="user_id" size="small" loading={loading} dataSource={rows} pagination={{pageSize:10}} locale={{emptyText:<Empty description="لا توجد حسابات مرتبطة"/>}} columns={[
 {title:"العميل",render:(_,r:Credit)=>parties[r.party_id]||"عميل #"+r.party_id},
 {title:"الشحن",render:(_,r:Credit)=><Tag color={r.enabled?"green":"default"}>{r.enabled?"مسموح":"موقوف"}</Tag>},
 {title:"السقف",render:(_,r:Credit)=>Number(r.credit_limit).toLocaleString("en-US")+" دج"},
 {title:"الدين",render:(_,r:Credit)=>Number(r.debt).toLocaleString("en-US")+" دج"},
 {title:"المتاح",render:(_,r:Credit)=>Math.max(0,Number(r.credit_limit)-Number(r.debt)).toLocaleString("en-US")+" دج"},
 {title:"",render:(_,r:Credit)=><Button size="small" onClick={()=>{setEditing(r);form.setFieldsValue({enabled:r.enabled,credit_limit:Number(r.credit_limit)});}}>تعديل</Button>}
 ]}/>
 <Modal title={"صلاحية الشحن — "+(editing?(parties[editing.party_id]||"عميل #"+editing.party_id):"")} open={!!editing} onCancel={()=>setEditing(null)} footer={null} destroyOnClose>
 <Form form={form} layout="vertical" onFinish={save}>
 <Form.Item label="سقف الدين (مضاعفات 5,000 دج)" name="credit_limit" rules={[{required:true},{validator:async(_,v)=>{if(v<0||v%5000!==0)throw Error("السقف يجب أن يكون من مضاعفات 5,000 دج");}}]}><InputNumber min={0} max={10000000} step={5000} precision={0} style={{width:"100%"}}/></Form.Item>
 <Form.Item label="السماح بالشحن الذاتي" name="enabled" valuePropName="checked"><Switch/></Form.Item>
 <Alert type="info" showIcon style={{marginBottom:16}} message="أقل شحن: 5,000 دج · ضمن سقف الدين"/>
 <Space><Button type="primary" htmlType="submit" loading={busy}>حفظ</Button><Button onClick={()=>setEditing(null)}>إلغاء</Button></Space>
 </Form>
 </Modal>
 </Card>;
}