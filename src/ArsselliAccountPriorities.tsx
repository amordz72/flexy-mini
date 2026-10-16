import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Collapse,InputNumber,Space,Switch,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

type PriorityRow={
 distributor_account_code:string;account_name:string;priority:number;enabled:boolean;
 baseline_amount:number|null;baseline_checked_at:string|null;
 pending_hold:number;spendable_balance:number|null;
};
type Draft={priority:number;enabled:boolean};
const money=(v:number|null)=>v===null?"لم يُقرأ بعد":Number(v).toLocaleString("en-US")+" دج";

// Admin-only RPCs own balance eligibility and account priorities.
// Preferences are never used to send a USSD or touch PINs from the browser.
export default function ArsselliAccountPriorities({db,simUuid}:{
 db:SupabaseClient;simUuid:string;
}){
 const [rows,setRows]=useState<PriorityRow[]>([]);
 const [drafts,setDrafts]=useState<Record<string,Draft>>({});
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [saving,setSaving]=useState<string|null>(null);
 const [error,setError]=useState("");

 const load=useCallback(async()=>{
  setBusy(true);
  try{
   const {data,error:rpcError}=await db.rpc("station_connect_admin_arsselli_account_preferences",{p_sim_uuid:simUuid});
   if(rpcError)throw rpcError;
   const items=(Array.isArray(data)?data:[]) as PriorityRow[];
   setRows(items);setDrafts({});
   setError("");setLoaded(true);
  }catch(cause){
   setError("تعذر تحميل ترتيب الموزعين: "+(cause instanceof Error?cause.message:String(cause)));
  }finally{setBusy(false);}
 },[db,simUuid]);

 useEffect(()=>{
  setLoaded(false);setRows([]);setDrafts({});setError("");setSaving(null);
 },[simUuid]);

 const save=async(row:PriorityRow)=>{
  if(saving||busy)return;
  const next=drafts[row.distributor_account_code]||{priority:row.priority,enabled:row.enabled};
  if(!Number.isInteger(next.priority)||next.priority<1||next.priority>1000){
   message.warning("الأولوية يجب أن تكون رقمًا بين 1 و1000");return;
  }
  setSaving(row.distributor_account_code);setError("");
  try{
   const {error:rpcError}=await db.rpc("station_connect_admin_set_arsselli_account_preference",{
    p_sim_uuid:simUuid,p_distributor_account_code:row.distributor_account_code,
    p_priority:next.priority,p_enabled:next.enabled
   });
   if(rpcError)throw rpcError;
   message.success("حُفظ ترتيب هذا الحساب على السيرفر");
   await load();
  }catch(cause){
   setError("تعذر حفظ أولوية الحساب: "+(cause instanceof Error?cause.message:String(cause)));
  }finally{setSaving(null);}
 };

 return <Collapse size="small" onChange={value=>{
  if((Array.isArray(value)?value:[value]).includes("priorities")&&!loaded&&!busy)void load();
 }} items={[{key:"priorities",label:"ترتيب حسابات الموزعين (من السيرفر)",children:
  <Space direction="vertical" size="small" style={{width:"100%"}}>
   <Typography.Text type="secondary">السيرفر يختار أصغر رقم أولوية من الحسابات المفعّلة التي تملك رصيدًا كافيًا. عند تساوي الأولوية يختار الرصيد المتاح الأكبر. التعديل لا يرسل فليكسي.</Typography.Text>
   <Button onClick={()=>void load()} loading={busy} size="small">تحديث الحسابات</Button>
   {error&&<Alert type="error" showIcon message={error}/>}
   {loaded&&rows.map(row=>{
    const draft=drafts[row.distributor_account_code]||{priority:row.priority,enabled:row.enabled};
    const dirty=draft.priority!==row.priority||draft.enabled!==row.enabled;
    return <Card key={row.distributor_account_code} size="small" title={row.distributor_account_code+" — "+row.account_name}>
     <Space direction="vertical" style={{width:"100%"}} size="small">
      <Typography.Text>المتاح: {money(row.spendable_balance)} | محجوز: {money(row.pending_hold)}</Typography.Text>
      <Space wrap size="small" align="center">
       <Typography.Text>الأولوية</Typography.Text>
       <InputNumber min={1} max={1000} precision={0} size="small" value={draft.priority}
        aria-label={"أولوية "+row.account_name}
        onChange={value=>setDrafts(current=>({...current,[row.distributor_account_code]:{
         ...draft,priority:value??row.priority
        }}))}/>
       <Switch size="small" checked={draft.enabled} checkedChildren="مفعّل" unCheckedChildren="معطّل"
        aria-label={"تفعيل "+row.account_name}
        onChange={enabled=>setDrafts(current=>({...current,[row.distributor_account_code]:{
         ...draft,enabled
        }}))}/>
       <Button size="small" type="primary" disabled={!dirty||Boolean(saving)||busy}
        loading={saving===row.distributor_account_code} onClick={()=>void save(row)}>حفظ</Button>
      </Space>
     </Space>
    </Card>;
   })}
   {loaded&&!rows.length&&<Typography.Text type="secondary">لا توجد حسابات متاحة</Typography.Text>}
  </Space>
 }]}/>;
}
