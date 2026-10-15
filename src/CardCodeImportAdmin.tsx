import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Alert, Button, Card, Input, Modal, Select, Space, Statistic, Table, Tag, Typography, Upload, message } from "antd";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";

type StockType = {type_key:string;name:string;family:string;active:boolean};
type Summary = {type_key:string;type_name:string;denomination:string;product_label:string;available_count:number;reserved_count:number;review_count:number;used_count:number;total_count:number};
const parse = (value:string) => [...new Set(value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
export default function CardCodeImportAdmin({db}:{db:SupabaseClient}) {
  const [authorized,setAuthorized]=useState(false);
  const [checked,setChecked]=useState(false);
  const [types,setTypes]=useState<StockType[]>([]);
  const [summary,setSummary]=useState<Summary[]>([]);
  const [batches,setBatches]=useState<Array<{batch_uuid:string;type_name:string;denomination:string;source_label:string;inserted_count:number;duplicate_count:number;created_at:string}>>([]);
  const [typeKey,setTypeKey]=useState<string>();
  const [denomination,setDenomination]=useState("");
  const [productLabel,setProductLabel]=useState("");
  const [codes,setCodes]=useState("");
  const [fileName,setFileName]=useState("");
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState("");
  const refresh=async()=>{
    setLoading(true);
    const [t,s,b]=await Promise.all([
      db.from("card_stock_types").select("type_key,name,family,active").eq("active",true).order("name"),
      db.rpc("card_stock_admin_summary"),
      db.rpc("card_stock_admin_recent_batches_v2",{p_limit:15})
    ]);
    setLoading(false);
    if(t.error||s.error){setError(t.error?.message||s.error?.message||"تعذر تحميل المخزون");return;}
    setError("");
    setTypes((t.data||[]) as StockType[]);
    setSummary((s.data||[]) as Summary[]);
    if(!b.error)setBatches(b.data||[]);
  };
  useEffect(()=>{
    let live=true;
    void db.rpc("flexy_mini_is_admin").then(({data,error})=>{
      if(!live)return;
      const ok=!error&&data===true;
      setAuthorized(ok);setChecked(true);
      if(ok)void refresh();
    });
    return ()=>{live=false;};
  },[db]);
  const start=(row?:Summary)=>{
    setTypeKey(row?.type_key);
    setDenomination(row?.denomination||"");
    setProductLabel(row?.product_label||"");
    setCodes("");setFileName("");setResult("");setOpen(true);
  };
  const save=async()=>{
    const rows=parse(codes);
    if(!authorized||!typeKey||!rows.length)return;
    setBusy(true);
    const {data,error:failure}=await db.rpc("card_stock_admin_import_batch_v2",{
      p_type_key:typeKey,p_denomination:denomination.trim()||null,
      p_source_kind:"supplier",p_source_label:"Flexy Mini",
      p_source_reference:fileName||null,p_note:null,
      p_rows:rows.map(code=>({code,serial:""})),
      p_product_label:productLabel.trim()||null,
      p_import_method:fileName?"file":"manual",p_legacy_uncertain:false
    });
    setBusy(false);
    if(failure){message.error("تعذر الحفظ: "+failure.message);return;}
    const x=Array.isArray(data)?data[0]:data;
    const info="جديدة: "+Number(x?.inserted_count||0)+" · مكررة: "+Number(x?.duplicate_count||0)+" · مرفوضة: "+Number(x?.invalid_count||0);
    setResult(info);message.success("تمت معالجة الدفعة");
    setOpen(false);setCodes("");setFileName("");
    void refresh();
  };
  if(!checked)return <Card loading/>;
  if(!authorized)return <Alert type="error" showIcon message="هذه الصفحة للإدارة فقط"/>;
  const total=summary.reduce((n,x)=>n+Number(x.available_count||0),0);
  const grouped=types.map(t=>({...t,rows:summary.filter(s=>s.type_key===t.type_key)}));
  const selected=grouped.find(t=>t.type_key===typeKey);
  const low=summary.filter(x=>Number(x.available_count)===0).length;
  return <Space direction="vertical" size="middle" style={{width:"100%"}}>
    {error&&<Alert type="error" showIcon message={error}/>}
    {result&&<Alert type="success" showIcon message={result}/>}
    {low>0&&<Alert type="warning" showIcon message={"يوجد "+low+" منتجات مسجلة نفد مخزونها"}/>}
    <Card><Space wrap size="large"><Statistic title="البطاقات المتاحة" value={total}/><Statistic title="المنتجات المسجلة في المخزون" value={summary.length}/><Button onClick={()=>void refresh()} loading={loading}>تحديث</Button><Button type="primary" icon={<PlusOutlined/>} onClick={()=>start()}>إضافة بطاقات</Button></Space></Card>
    <Select placeholder="اختر نوع البطاقة" allowClear value={typeKey} onChange={setTypeKey} style={{width:"100%"}} options={types.map(t=>({value:t.type_key,label:t.name}))}/>
    {grouped.filter(t=>!typeKey||t.type_key===typeKey).map(t=><Card key={t.type_key} title={t.name} extra={<Button size="small" onClick={()=>start({type_key:t.type_key,type_name:t.name,denomination:"",product_label:"",available_count:0,reserved_count:0,review_count:0,used_count:0,total_count:0})}>إضافة</Button>}>
      <Typography.Text type="secondary">الأقسام المسجلة: {[...new Set(t.rows.map(r=>r.product_label||"عام"))].join("، ")||"لا توجد أقسام بعد"}</Typography.Text>
      <Table size="small" rowKey={r=>r.type_key+"|"+r.product_label+"|"+r.denomination} loading={loading} pagination={{pageSize:10}} dataSource={t.rows} locale={{emptyText:"لا توجد بطاقات مسجلة لهذا النوع"}} columns={[
        {title:"القسم / المنتج",render:(_,r)=><Typography.Text>{r.product_label||t.name}</Typography.Text>},
        {title:"القيمة",dataIndex:"denomination",render:(v:string)=>v||"—"},
        {title:"المتاح",dataIndex:"available_count",render:(v:number)=><Tag color={Number(v)>0?"green":"red"}>{v}</Tag>},
        {title:"إضافة",render:(_,r)=><Button size="small" onClick={()=>start(r)}>رفع أكواد</Button>}
      ]}/>
    </Card>)}
    <Card title="آخر دفعات المخزون"><Table size="small" rowKey="batch_uuid" pagination={{pageSize:5}} scroll={{x:500}} dataSource={batches} columns={[{title:"النوع",dataIndex:"type_name"},{title:"القيمة",dataIndex:"denomination"},{title:"المصدر",dataIndex:"source_label"},{title:"جديدة",dataIndex:"inserted_count"},{title:"مكررة",dataIndex:"duplicate_count"}]}/></Card>
    <Modal title="إضافة أكواد البطاقات" open={open} onCancel={()=>setOpen(false)} onOk={()=>void save()} okText="حفظ في المخزون" okButtonProps={{disabled:!typeKey||!parse(codes).length,loading:busy}} confirmLoading={busy} destroyOnHidden>
      <Space direction="vertical" style={{width:"100%"}}>
        <Select placeholder="نوع البطاقة" value={typeKey} onChange={setTypeKey} options={types.map(t=>({value:t.type_key,label:t.name}))} style={{width:"100%"}}/>
        <Input placeholder="القسم أو اسم المنتج" value={productLabel} onChange={e=>setProductLabel(e.target.value)}/>
        <Input placeholder="القيمة (مثال 2000)" value={denomination} onChange={e=>setDenomination(e.target.value)}/>
        <Input.TextArea rows={7} dir="ltr" style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",fontVariantNumeric:"tabular-nums"}} value={codes} onChange={e=>{setCodes(e.target.value);setFileName("");}} placeholder={"كل كود في سطر مستقل"}/>
        <Upload accept=".txt,text/plain" maxCount={1} showUploadList={false} beforeUpload={async f=>{try{setCodes(await f.text());setFileName(f.name);}catch{message.error("تعذرت قراءة الملف");}return false;}}><Button icon={<UploadOutlined/>}>اختيار ملف TXT</Button></Upload>
        <Typography.Text type="secondary">عدد الأكواد بدون تكرار: {parse(codes).length}</Typography.Text>
        <Alert type="info" showIcon message="التحقق المحلي من الصيغة مؤجل؛ قواعد المخزون المركزية ما زالت مطبقة على الخادم."/>
        {selected?.name&&<Typography.Text type="secondary">النوع: {selected.name}</Typography.Text>}
      </Space>
    </Modal>
  </Space>;
}
