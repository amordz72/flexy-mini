import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Authenticated, Refine, useLogin, useLogout } from "@refinedev/core";
import type { AuthProvider } from "@refinedev/core";
import { AuthPage } from "@refinedev/antd";
import { HashRouter, Route, Routes } from "react-router";
import routerProvider from "@refinedev/react-router";
import { createClient } from "@supabase/supabase-js";
import { dataProvider, liveProvider } from "@refinedev/supabase";

import { ConfigProvider, Form, Input, Layout, Menu, Typography, Card, Row, Col, Table, Tag, Button, Space, Alert, Grid, Drawer, Empty, Descriptions, Select } from "antd";
import "antd/dist/reset.css";
import "./style.css";
import AdSystem from "./AdSystem";
import AdminWallet from "./AdminWallet";
import CreditAdmin from "./CreditAdmin";
import { supportPhone, supportWhatsApp } from "./settings";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://wqyebqzbbpohbnznqdjj.supabase.co";
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || "sb_publishable_gO4umNBMJ0AWRk19HtKd7A_9X4DibYj";
const client = url && key ? createClient(url, key, { auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true } }) : undefined;
// Existing MyTool RLS is the source of truth for admin access.
async function isShopAdmin(): Promise<boolean> {
  if (!client) return false;
  const { data, error } = await client.rpc("flexy_mini_is_admin");
  return !error && data === true;
}
const authProvider: AuthProvider | undefined = client ? {
  login: async ({ identifier, email, password }) => {
    const value = String(identifier || email || "").trim();
    if (!value.includes("@") && !/^\+?[0-9]{8,15}$/.test(value)) return { success: false, error: { name: "UnlinkedUsername", message: "اسم المستخدم غير مربوط بحساب الإدارة بعد. استعمل البريد الإلكتروني حاليًا." } };
    const credentials = value.includes("@") ? { email: value, password } : { phone: value, password };
    const { error } = await client.auth.signInWithPassword(credentials);
    if (error) return { success: false, error: { name: "LoginError", message: "تعذر تسجيل الدخول" } };
    if (!(await isShopAdmin())) {await client.auth.signOut();return {success:false,error:{name:"AccessDenied",message:"دخول الإدارة فقط. استعمل صفحة دخول الزبون"}};}
    return { success: true, redirectTo: "/" };
  },
  logout: async () => {
    const { error } = await client.auth.signOut();
    return error ? { success: false, error: { name: "LogoutError", message: "تعذر تسجيل الخروج" } } : { success: true, redirectTo: "/login" };
  },
  check: async () => {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) return { authenticated: false, redirectTo: "/login" };
    if (await isShopAdmin()) return { authenticated: true };
    await client.auth.signOut();return {authenticated:false,redirectTo:"/customer-login"};
  },
  onError: async () => ({ error: undefined }),
  getIdentity: async () => {
    const { data } = await client.auth.getUser();
    return data.user ? { id: data.user.id, name: data.user.email || "مستخدم" } : null;
  },
} : undefined;
function LoginPage() {
  const { mutate: login, isPending } = useLogin();
  return <ConfigProvider direction="rtl" theme={{ token: { colorPrimary: "#2563eb" } }}>
    <div dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f6fa", padding: 16 }}>
      <Card title="⚡ فليكسي ميني — تسجيل الدخول" style={{ width: "100%", maxWidth: 420 }}>
        <Form layout="vertical" onFinish={(values) => login(values)}>
          <Form.Item label="البريد الإلكتروني أو اسم المستخدم أو رقم الهاتف" name="identifier" rules={[{ required: true, message: "أدخل معرّف الحساب" }]}>
            <Input autoComplete="username" placeholder="البريد أو المستخدم أو الهاتف" size="large" dir="ltr" />
          </Form.Item>
          <Form.Item label="كلمة المرور" name="password" rules={[{ required: true, message: "أدخل كلمة المرور" }]}>
            <Input.Password autoComplete="current-password" size="large" dir="ltr" />
          </Form.Item>
          <Button htmlType="submit" type="primary" size="large" loading={isPending} block>دخول</Button>
          <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
            البريد الإلكتروني يعمل حاليًا. رقم الهاتف يعمل إذا كان مسجلًا في حساب المصادقة، واسم المستخدم يحتاج ربطًا آمنًا قبل تفعيله.
          </Typography.Paragraph>
        </Form>
      </Card>
    </div>
  </ConfigProvider>;
}
const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const items = [
 {type:"group" as const,label:"الخدمات",children:[
  {key:"home",icon:<span>⌂</span>,label:"الرئيسية"},
  {key:"flexy",icon:<span>☎</span>,label:"فليكسي"},
  {key:"idoom",icon:<span>◉</span>,label:"تعبئة إيدوم"},
  {key:"store",icon:<span>▤</span>,label:"البطاقات"},
  {key:"operations",icon:<span>◷</span>,label:"عملياتي"}
 ]},
 {type:"group" as const,label:"الإدارة",children:[
  {key:"cards",icon:<span>▦</span>,label:"إدارة البطاقات والأصناف"},
  {key:"inventory",icon:<span>＋</span>,label:"أكواد البطاقات"},
  {key:"customers",icon:<span>♙</span>,label:"الزبائن"},
  {key:"devices",icon:<span>▣</span>,label:"الأجهزة الموثوقة"},
  {key:"stations",icon:<span>▣</span>,label:"المحطات والشرائح"},
  {key:"members",icon:<span>♧</span>,label:"المستخدمون والصلاحيات"},
  {key:"ads",icon:<span>◈</span>,label:"إدارة الإعلانات"},
  {key:"settings",icon:<span>⚙</span>,label:"الإعدادات"}
 ]}
];
const names:Record<string,string>={devices:"الأجهزة الموثوقة وطلبات الاعتماد",home:"الرئيسية",flexy:"الفليكسي",idoom:"تعبئة إيدوم",store:"متجر البطاقات",operations:"العمليات",cards:"إدارة البطاقات والأصناف",inventory:"إضافة أكواد البطاقات",customers:"إدارة الزبائن",stations:"المحطات والشرائح",members:"المستخدمون والصلاحيات",ads:"إدارة الإعلانات",settings:"الإعدادات"};
const sample = [
  { key: "1", name: "موبيليس", kind: "فليكسي", state: "واجهة تجريبية" },
  { key: "2", name: "بطاقات موبيليس", kind: "بطاقات", state: "غير مربوط" },
  { key: "3", name: "Station Connect", kind: "محطات", state: "غير مربوط" },
];
type MiniMember = { id: number; party_id: number; role: string; active: boolean };
function MiniMembers() {
  const [members, setMembers] = useState<MiniMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    if (!client) return;
    client.from("flexy_mini_members").select("id,party_id,role,active").order("id", { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (!live) return;
        setLoading(false);
        if (error) setError("تعذر تحميل العضويات: " + error.message);
        else setMembers((data || []) as MiniMember[]);
      });
    return () => { live = false; };
  }, []);
  return <Card title="عضويات Flexy Mini">
    <Alert type="info" showIcon message="العضويات مستقلة عن MyTool. الدخول بالـPIN لم يُفعّل بعد. لا تمنح العضوية وحدها دخولًا." style={{ marginBottom: 16 }} />
    {error && <Alert type="warning" showIcon message={error} style={{ marginBottom: 16 }} />}
    <Table loading={loading} rowKey="id" dataSource={members} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 430 }} columns={[
      { title: "معرّف الماستر", dataIndex: "party_id" },
      { title: "الدور", dataIndex: "role" },
      { title: "الحالة", dataIndex: "active", render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "مفعّل" : "غير مفعّل"}</Tag> }
    ]} />
  </Card>;
}

type CatalogCategory = { id: number; name: string; sort_index: number; active: boolean };
type CatalogProduct = { id: number; category_id: number; name: string; sort_index: number; active: boolean; display_mode: string };
type CatalogVariant = { id: number; product_id: number; name: string; denomination: number | null; purchase_price: number; markup_percent: number; sort_index: number; active: boolean; display_mode: string; stock_quantity: number };
function CardsCatalog() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [categoryForm] = Form.useForm();
  const [productForm] = Form.useForm();
  const [variantForm] = Form.useForm();
  async function refresh() {
    if (!client) return;
    setBusy(true);
    const [c, p, v] = await Promise.all([
      client.from("flexy_mini_categories").select("*").order("sort_index").order("id"),
      client.from("flexy_mini_products").select("*").order("sort_index").order("id"),
      client.from("flexy_mini_variants").select("*").order("sort_index").order("denomination").order("id")
    ]);
    setBusy(false);
    const issue = c.error || p.error || v.error;
    if (issue) { setError(issue.message); return; }
    setError("");
    setCategories((c.data || []) as CatalogCategory[]);
    setProducts((p.data || []) as CatalogProduct[]);
    setVariants((v.data || []) as CatalogVariant[]);
  }
  useEffect(() => { void refresh(); }, []);
  async function save(table: string, payload: Record<string, unknown>, form: ReturnType<typeof Form.useForm>[0]) {
    if (!client) return;
    setBusy(true);
    const { error } = await client.from(table).insert(payload);
    setBusy(false);
    if (error) { setError(error.message); return; }
    form.resetFields();
    await refresh();
  }
  async function toggleVisibility(table: "flexy_mini_products" | "flexy_mini_variants", id: number, mode: string) {
    if (!client) return;
    const { error } = await client.from(table).update({ display_mode: mode === "hidden" ? "visible" : "hidden" }).eq("id", id);
    if (error) setError(error.message); else await refresh();
  }
  const visibleProducts = products.filter(p => p.category_id === categoryId && p.active);
  const visibleVariants = variants.filter(v => v.product_id === productId && v.active)
    .sort((a, b) => a.sort_index - b.sort_index || (a.denomination ?? 999999) - (b.denomination ?? 999999) || a.id - b.id);
  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <Alert type="info" showIcon message="إدارة كتالوج البطاقات: قسم ← نوع ← بطاقة. لا توجد مبيعات أو أكواد شحن مفعّلة." />
    {error && <Alert type="error" showIcon message={error} closable onClose={() => setError("")} />}
    <Card title="1 — الأقسام" loading={busy && !categories.length}>
      <Space wrap>{categories.filter(c => c.active).map(c => <Button key={c.id} type={categoryId === c.id ? "primary" : "default"} onClick={() => { setCategoryId(c.id); setProductId(null); }}>{c.name} <Tag style={{marginInlineStart:6}}>{products.filter(p=>p.category_id===c.id).length} أنواع</Tag></Button>)}</Space>
      <Form form={categoryForm} layout="inline" style={{ marginTop: 16, gap: 8 }} onFinish={v => save("flexy_mini_categories", { name: v.name.trim(), sort_index: Number(v.sort_index || 0) }, categoryForm)}>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="اسم القسم" /></Form.Item>
        <Form.Item name="sort_index" initialValue={0}><Input type="number" placeholder="Index" style={{ width: 90 }} /></Form.Item>
        <Button htmlType="submit" type="primary" disabled={busy}>إضافة قسم</Button>
      </Form>
    </Card>
    {categoryId !== null && <Card title="2 — الأنواع">
      <Space wrap>{visibleProducts.map(p => <Space key={p.id} size={4}><Button type={productId === p.id ? "primary" : "default"} onClick={() => { setProductId(p.id); window.setTimeout(() => document.getElementById("mini-variants")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>{p.name} <Tag style={{marginInlineStart:6}}>{variants.filter(v=>v.product_id===p.id).length} بطاقات</Tag></Button><Button size="small" onClick={() => toggleVisibility("flexy_mini_products", p.id, p.display_mode)}>{p.display_mode === "hidden" ? "إظهار" : "تجميد"}</Button></Space>)}</Space>
      <Form form={productForm} layout="inline" style={{ marginTop: 16, gap: 8 }} onFinish={v => save("flexy_mini_products", { category_id: categoryId, name: v.name.trim(), sort_index: Number(v.sort_index || 0) }, productForm)}>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="اسم النوع" /></Form.Item>
        <Form.Item name="sort_index" initialValue={0}><Input type="number" placeholder="Index" style={{ width: 90 }} /></Form.Item>
        <Button htmlType="submit" type="primary" disabled={busy}>إضافة نوع</Button>
      </Form>
    </Card>}
    {productId !== null && <Card id="mini-variants" title="3 — البطاقات">
      <Row gutter={[12, 12]}>{visibleVariants.map(v => <Col xs={24} sm={12} lg={8} key={v.id}><Card size="small" title={v.name}><Text>القيمة: {v.denomination ?? "—"}</Text><div>سعر الشراء: {v.purchase_price} دج</div><div>الربح: {v.markup_percent}%</div><Title level={5}>سعر البيع: {(Number(v.purchase_price) * (1 + Number(v.markup_percent) / 100)).toFixed(2)} دج</Title><Tag>Index {v.sort_index}</Tag><Tag color="blue">المخزون: {v.stock_quantity}</Tag><Tag color={v.display_mode === "hidden" ? "red" : v.stock_quantity > 0 ? "green" : "orange"}>{v.display_mode === "hidden" ? "مجمّدة" : v.stock_quantity > 0 ? "متوفرة" : "غير متوفرة"}</Tag><Button size="small" onClick={() => toggleVisibility("flexy_mini_variants", v.id, v.display_mode)}>{v.display_mode === "hidden" ? "إظهار" : "تجميد"}</Button></Card></Col>)}</Row>
      <Form form={variantForm} layout="vertical" style={{ marginTop: 16 }} onFinish={v => save("flexy_mini_variants", { product_id: productId, name: v.name.trim(), denomination: Number(v.denomination || 0), purchase_price: Number(v.purchase_price), markup_percent: Number(v.markup_percent || 0), sort_index: Number(v.sort_index || 0) }, variantForm)}>
        <Row gutter={8}>
          <Col xs={24} sm={12}><Form.Item name="name" label="اسم البطاقة" rules={[{ required: true }]}><Input placeholder="مثلاً 60 UC" /></Form.Item></Col>
          <Col xs={12} sm={6}><Form.Item name="denomination" label="القيمة"><Input type="number" min={0} /></Form.Item></Col>
          <Col xs={12} sm={6}><Form.Item name="sort_index" label="Index" initialValue={0}><Input type="number" /></Form.Item></Col>
          <Col xs={12}><Form.Item name="purchase_price" label="سعر الشراء (دج)" rules={[{ required: true }]}><Input type="number" min={0} step="0.01" /></Form.Item></Col>
          <Col xs={12}><Form.Item name="markup_percent" label="نسبة الربح %" initialValue={0}><Input type="number" min={0} step="0.01" /></Form.Item></Col>
        </Row>
        <Button htmlType="submit" type="primary" disabled={busy}>إضافة بطاقة</Button>
      </Form>
    </Card>}
  </Space>;
}
function MasterCustomerLookup() {
  const [query,setQuery]=useState("");
  const [matches,setMatches]=useState<Array<{id:number;display_name:string;primary_phone?:string|null;mytool_username?:string|null}>>([]);
  const [selected,setSelected]=useState<number|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [creating,setCreating]=useState(false);
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [saving,setSaving]=useState(false);
  const [savedMessage,setSavedMessage]=useState("");
  const [accounts,setAccounts]=useState<Array<{id:number;party_id:number;username:string;phone:string;active:boolean}>>([]);
  const [masterRecord,setMasterRecord]=useState<{id:number;display_name:string;primary_phone?:string|null;mytool_username?:string|null}|null>(null);
  const assignMaster=(r:{id:number;display_name:string;primary_phone?:string|null;mytool_username?:string|null},overwrite=false)=>{
    setSelected(r.id);setMasterRecord(r);setMatches([r]);
    if(overwrite||name.trim()!==r.display_name)setName(r.display_name||"");
    const digits=(r.primary_phone||"").replace(/\D/g,"");
    const normalized=digits.startsWith("213")?"0"+digits.slice(3):digits;
    if(normalized)setPhone(normalized);
    const candidate=(r.mytool_username||"").trim();
    if(candidate&&!/^mt\d*_\d+$/i.test(candidate)&&(overwrite||!username.trim()))setUsername(candidate);
  };
  useEffect(()=>{
    if(!client || selected || query.trim().length<2){if(!selected)setMatches([]);return;}
    let active=true;
    const timer=window.setTimeout(async()=>{
      setBusy(true);
      const result=await client!.rpc("admin_customer_master_search",{p_query:query.trim(),p_limit:10});
      if(!active)return;
      setBusy(false);
      if(result.error){setError("تعذر البحث في الماستر بهذه الصلاحيات");setMatches([]);}
      else {setError("");setMatches(Array.isArray(result.data)?result.data:[]);}
    },350);
    return ()=>{active=false;window.clearTimeout(timer);};
  },[query,selected]);
  const loadAccounts=async()=>{if(!client)return;const {data,error}=await client.functions.invoke("flexy-mini-customers",{body:{action:"list"}});if(!error&&Array.isArray(data?.customers))setAccounts(data.customers);};
  useEffect(()=>{void loadAccounts();},[]);
  const createAccount=async()=>{
    if(!client||!selected||!username.trim()||!/^0[567][0-9]{8}$/.test(phone)){setError("اختر الماستر وأدخل اسم مستخدم وهاتفًا جزائريًا صحيحًا");return;}
    const generatedPassword = !password;
    const effectivePassword = password || Array.from(crypto.getRandomValues(new Uint8Array(8)), n => String((n % 8) + 1)).join("");
    setSaving(true);setError("");setSavedMessage("");
    const {data,error}=await client.functions.invoke("flexy-mini-customers",{body:{action:"create",party_id:selected,username:username.trim(),phone,password:effectivePassword}});
    setSaving(false);
    if(error||!data?.customer){setError(data?.error||"تعذر إنشاء الحساب. تأكد من عدم تكرار الاسم أو الهاتف أو الماستر.");return;}
    setSavedMessage("تم إنشاء الحساب: "+data.customer.username+" — "+data.customer.phone+(generatedPassword?" — كلمة المرور المولّدة: "+effectivePassword:""));
    setPassword("");setCreating(false);void loadAccounts();
  };
  return <Space direction="vertical" size="middle" style={{width:"100%"}}>
    <Card title="زبائن Flexy Mini" extra={<Button type="primary" onClick={()=>{if(!creating)setPassword(Array.from(crypto.getRandomValues(new Uint8Array(8)), n => String((n % 8) + 1)).join(""));setCreating(v=>!v);}}>{creating?"إغلاق":"زبون جديد +"}</Button>}>
      <Alert type="info" showIcon message="الجدول يعرض حسابات Flexy Mini عند تفعيل خدمة الحسابات. لا نعرض كل الماستر كأنهم زبائن مسجلون."/>
      {savedMessage&&<Alert type="success" style={{marginTop:12}} message={savedMessage}/>}
      <Table size="small" rowKey="id" style={{marginTop:12}} dataSource={accounts.map(a=>({...a,name:a.phone,master:a.party_id,status:a.active?"نشط":"معطل"}))} columns={[
        {title:"الزبون",dataIndex:"name"},
        {title:"اسم المستخدم",dataIndex:"username"},
        {title:"الماستر",dataIndex:"master"},
        {title:"الحالة",dataIndex:"status"}
      ]} locale={{emptyText:"لا توجد حسابات Flexy Mini مؤكدة بعد"}}/>
    </Card>
    {creating&&<Card title="زبون جديد — مطابقة الماستر">
      <Alert type="info" showIcon message="اختر الماستر أولًا ثم اسم الدخول. تظهر كلمة مرور عشوائية عند فتح النموذج ويمكنك تعديلها."/>
      <Form layout="vertical" style={{marginTop:14}}>
        <Form.Item label="اسم الزبون"><Input value={name} onChange={e=>{setName(e.target.value);setSelected(null);setQuery(e.target.value);}} placeholder="الاسم الكامل"/></Form.Item>
        <Form.Item label="رقم الهاتف"><Input dir="ltr" value={phone} onChange={e=>{const v=e.target.value.replace(/[^0-9+]/g,"");setPhone(v);if(!selected&&v.replace(/\D/g,"").length>=5)setQuery(v);}} placeholder="0XXXXXXXXX"/></Form.Item>
        <Form.Item label="اسم المستخدم"><Input dir="ltr" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username"/></Form.Item>
        <Form.Item label="كلمة المرور (مولّدة تلقائيًا — يمكنك تعديلها)"><Input.Password value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></Form.Item>
        <Form.Item label="بحث إضافي في الماستر"><Input value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);setMasterRecord(null);}} placeholder="اسم أو هاتف أو حساب منصة" allowClear/></Form.Item>
      </Form>
      {error&&<Alert type="warning" message={error}/>}
      {busy&&<Text type="secondary">جاري البحث...</Text>}
      {!busy&&query.trim().length>=2&&matches.length===0&&<Empty description="لا توجد نتائج مطابقة — يمكن إنشاء ماستر جديد عند تفعيل الحفظ" />}
      <Space direction="vertical" size="small" style={{width:"100%",marginTop:12}}>
        {matches.map(r=><Card key={r.id} size="small" style={{borderColor:selected===r.id?"#1677ff":undefined}}>
          <Space direction="vertical" size="small" style={{width:"100%"}}>
            <Text strong>{r.display_name}</Text>
            <Text type="secondary">الهاتف: <span dir="ltr" style={{display:"inline-block"}}>{r.primary_phone||"غير مسجل"}</span></Text>
            {r.mytool_username&&<Text type="secondary">معرف الماستر: <span dir="ltr">{r.mytool_username}</span></Text>}
            {selected===r.id?<Text type="success">✓ تم اختيار هذا الماستر</Text>:<Button block type="default" onClick={()=>assignMaster(r)}>اختيار هذا الماستر</Button>}
          </Space>
        </Card>)}
      </Space>
      {masterRecord&&<Space wrap style={{marginTop:12}}><Button onClick={()=>assignMaster(masterRecord,true)}>إسناد بيانات الماستر</Button><Text type="secondary">تعبئة الاسم والهاتف واسم المستخدم غير التقني من الماستر</Text></Space>}
      <Alert style={{marginTop:12}} type={selected?"success":"info"} message={selected?"تم اختيار ماستر موجود. سيُربط عند الحفظ بعد تجهيز الخدمة.":"إذا لم يوجد تطابق، يلزم إنشاء ماستر جديد عند الحفظ. لا يُسمح بحساب دون ماستر."}/>
      <Button style={{marginTop:12}} type="primary" loading={saving} disabled={!selected||!username||!phone} onClick={()=>void createAccount()}>حفظ الزبون وإنشاء الحساب</Button>
    </Card>}
  </Space>;
}
function ConnectionDiagnostics() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  async function checkConnection() {
    if (!url || !key) {
      setStatus("error");
      setMessage("متغيرات الاتصال العامة غير مضبوطة في إعدادات النشر.");
      return;
    }
    setStatus("loading");
    setMessage("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url.replace(/\/$/, "") + "/auth/v1/settings", {
        headers: { apikey: key },
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      setStatus("ok");
      setMessage("تم الوصول إلى خدمة Supabase Auth. لم يتم اختبار قاعدة البيانات أو الصلاحيات.");
    } catch {
      setStatus("error");
      setMessage("تعذر الوصول إلى خدمة المصادقة. تحقق من إعدادات النشر والاتصال.");
    } finally {
      window.clearTimeout(timeout);
    }
  }
  return <Card title="فحص اتصال Supabase" className="section-card">
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label="رقم دعم واتساب"><span dir="ltr">{supportPhone}</span></Descriptions.Item>
      <Descriptions.Item label="عنوان المشروع">{url ? "مضبوط" : "غير مضبوط"}</Descriptions.Item>
      <Descriptions.Item label="المفتاح العام">{key ? "مضبوط" : "غير مضبوط"}</Descriptions.Item>
      <Descriptions.Item label="قاعدة البيانات">غير مختبرة</Descriptions.Item>
      <Descriptions.Item label="حماية الوصول">التحقق من إدارة الحساب عبر RPC</Descriptions.Item>
    </Descriptions>
    <Space direction="vertical" className="diagnostics-actions">
      <Button type="primary" loading={status === "loading"} onClick={checkConnection}>اختبار الوصول لخدمة المصادقة</Button>
      {status !== "idle" && status !== "loading" && <Alert showIcon type={status === "ok" ? "success" : "warning"} message={message} />}
      <Text type="secondary">الفحص لا يقرأ جداول ولا يكتب بيانات، ولا يطلب كلمة مرور.</Text>
    </Space>
  </Card>;
}
type TrustedDevice={id:number;customer_id:number;device_label:string;approved_at:string|null;revoked_at:string|null;expires_at:string|null;created_at:string;last_used_at:string|null;flexy_mini_customer_accounts:{username:string;phone:string;money_party_directory:{display_name:string}}};
function TrustedDevices(){
  const [kinds,setKinds]=useState<Record<number,string>>({});
  const [devices,setDevices]=useState<TrustedDevice[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const load=async()=>{setBusy(true);try{const {data,error}=await client!.functions.invoke("flexy-mini-customers",{body:{action:"devices"}});if(error||!data?.devices)throw new Error(data?.error||"تعذر تحميل الأجهزة");setDevices(data.devices);}catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال");}finally{setBusy(false);}};
  useEffect(()=>{void load();},[]);
  const change=async(id:number,action:string)=>{setBusy(true);setError("");try{const {data,error}=await client!.functions.invoke("flexy-mini-customers",{body:{action,device_id:id,device_kind:kinds[id]||"desktop"}});if(error){let message=data?.error;try{message=(await error.context.json()).error;}catch{}throw new Error(message||"تعذر تحديث الجهاز");}await load();}catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال");}finally{setBusy(false);}};
  const state=(d:TrustedDevice)=>d.revoked_at?"ملغى":!d.approved_at?"بانتظار الاعتماد":new Date(d.expires_at||0).getTime()<=Date.now()?"منتهي":"معتمد";
  return <Card title="الأجهزة الموثوقة" extra={<Button loading={busy} onClick={()=>void load()}>تحديث</Button>}>
    <Alert type="info" message="جهازان كحد أقصى لكل زبون. اعتماد الكمبيوتر 7 أيام والهاتف 30 يومًا، وإلغاء الاعتماد يبطل كل جلسات الجهاز." style={{marginBottom:12}}/>
    {error&&<Alert type="error" message={error} style={{marginBottom:12}}/>}
    <Table rowKey="id" loading={busy} dataSource={devices} pagination={{pageSize:10}} scroll={{x:850}} columns={[
      {title:"الزبون",render:(_,d)=>d.flexy_mini_customer_accounts?.money_party_directory?.display_name||d.flexy_mini_customer_accounts?.username},
      {title:"المستخدم",render:(_,d)=>d.flexy_mini_customer_accounts?.username},
      {title:"الجهاز",render:(_,d)=>d.device_label+" #"+d.id},
      {title:"الحالة",render:(_,d)=><Tag color={state(d)==="معتمد"?"green":"orange"}>{state(d)}</Tag>},
      {title:"تاريخ الطلب",render:(_,d)=>new Date(d.created_at).toLocaleString("ar-DZ")},
      {title:"آخر استعمال",render:(_,d)=>d.last_used_at?new Date(d.last_used_at).toLocaleString("ar-DZ"):"لم يدخل بعد"},
      {title:"الإجراءات",render:(_,d)=><Space>{state(d)!=="معتمد"&&<Select value={kinds[d.id]||"desktop"} onChange={v=>setKinds({...kinds,[d.id]:v})} options={[{value:"desktop",label:"كمبيوتر · 7 أيام"},{value:"mobile",label:"هاتف · 30 يومًا"}]} />}{state(d)!=="معتمد"&&<Button disabled={busy} onClick={()=>void change(d.id,"approve_device")}>اعتماد الجهاز</Button>}{!d.revoked_at&&<Button danger disabled={busy} onClick={()=>void change(d.id,"revoke_device")}>إلغاء الاعتماد</Button>}</Space>}
    ]}/>
  </Card>;
}
function deviceSecret(){
  let value=localStorage.getItem("flexy_mini_device_secret");
  if(!value||! /^[0-9a-f]{64}$/.test(value)){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");localStorage.setItem("flexy_mini_device_secret",value);}
  return value;
}
function TableCustomerLogin(){
  const [identifier,setIdentifier]=useState("");
  const [blocked,setBlocked]=useState(false);
  const [password,setPassword]=useState("");
  const [token,setToken]=useState(()=>window.sessionStorage.getItem("flexy_mini_customer_token")||"");
  const [account,setAccount]=useState<{username:string;phone?:string;party_id:number}|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const call=async(body:Record<string,unknown>)=>{
    const response=await fetch(url+"/functions/v1/flexy-mini-customers",{method:"POST",headers:{"Content-Type":"application/json",apikey:key},body:JSON.stringify({...body,device_secret:deviceSecret(),device_label:/Android|iPhone|iPad/i.test(navigator.userAgent)?"هاتف / متصفح":"كمبيوتر / متصفح"})});
    return {ok:response.ok,data:await response.json()};
  };
  useEffect(()=>{if(!token)return;let active=true;
    const check=()=>void call({action:"me",token}).then(r=>{if(!active)return;if(r.ok)setAccount(r.data);else{window.sessionStorage.removeItem("flexy_mini_customer_token");setToken("");setAccount(null);setError(r.data.error||"انتهت الجلسة");}}).catch(()=>{if(active){setAccount(null);setError("تعذر التحقق من الجلسة");}});
    check();const timer=window.setInterval(check,15000);window.addEventListener("focus",check);
    return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",check);};
  },[token]);
  const login=async()=>{setBusy(true);setError("");try{const r=await call({action:"login",identifier,password});if(!r.ok){setBlocked(r.data.code==="DEVICE_PENDING"||r.data.code==="DEVICE_REVOKED");setError(r.data.error||"بيانات الدخول غير صحيحة");return;}window.sessionStorage.setItem("flexy_mini_customer_token",r.data.token);setToken(r.data.token);setPassword("");}catch{setError("تعذر الاتصال بالخادم");}finally{setBusy(false);}};
  const logout=async()=>{try{await call({action:"logout",token});}catch{}window.sessionStorage.removeItem("flexy_mini_customer_token");setToken("");setAccount(null);};
  return <ConfigProvider direction="rtl"><div style={{maxWidth:460,margin:"60px auto",padding:16}}>
    <Card title="Flexy Mini — دخول الزبون">
      {account?<Space direction="vertical" style={{width:"100%"}}><Alert type="success" message={"مرحبًا "+account.username}/><Text>الهاتف: <span dir="ltr">{account.phone}</span></Text><Alert type="warning" message="عمليات الشحن والدين غير مفعلة لهذا الحساب حاليًا"/><Button onClick={()=>void logout()}>تسجيل الخروج</Button></Space>:<Space direction="vertical" style={{width:"100%"}}>
        <Input value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="اسم المستخدم أو رقم الهاتف" dir="ltr"/>
        <Input.Password value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور"/>
        {error&&<Alert type="error" message={error}/>}
        {blocked&&<><Button block href={supportWhatsApp} target="_blank" rel="noopener noreferrer">طلب الدعم عبر واتساب</Button><Text type="secondary">دعم: <span dir="ltr">{supportPhone}</span></Text></>}
        <Button type="primary" block loading={busy} onClick={()=>void login()}>دخول</Button>
      </Space>}
      <a href="#/login">دخول الإدارة</a>
    </Card>
  </div></ConfigProvider>;
}
function CustomerDashboard() {
  const { mutate: logout } = useLogout();
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.rpc("flexy_mini_credit_status").then(({ data, error }) => {
      if (!active) return;
      if (error) { setError("تعذر تحميل حساب العميل"); return; }
      const record = Array.isArray(data) ? data[0] : data;
      if (record && typeof record === "object" && !Array.isArray(record)) setStatus(record as Record<string, unknown>);
      else setError("لم يتم العثور على حساب عميل مربوط");
    });
    return () => { active = false; };
  }, []);
  const money = (key: string) => {
    const value = status?.[key];
    const number = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(number) ? number.toLocaleString("en-US") + " دج" : "غير متاح";
  };
  return <ConfigProvider direction="rtl"><div dir="rtl" style={{padding:20,maxWidth:700,margin:"auto"}}>
    <Space style={{width:"100%",justifyContent:"space-between"}}><Typography.Title level={3}>حسابي — فليكسي ميني</Typography.Title><Button onClick={()=>logout()}>خروج</Button></Space>
    <Alert type="info" showIcon message="عرض حساب العميل فقط. لا يوجد شحن أو تنفيذ مالي مفعّل." style={{marginBottom:16}}/>
    {error ? <Alert type="error" message={error}/> : status ? <Card title="حالة حسابي"><Descriptions column={1} bordered size="small">
      <Descriptions.Item label="صلاحية الشحن">{status.enabled === true ? "مسموح مبدئيًا — التنفيذ معطّل" : "غير مفعّلة"}</Descriptions.Item>
      <Descriptions.Item label="سقف الدين">{money("credit_limit")}</Descriptions.Item>
      <Descriptions.Item label="الدين المسجل">{money("debt")}</Descriptions.Item>
      <Descriptions.Item label="الرصيد">{money("wallet_balance")}</Descriptions.Item>
    </Descriptions></Card> : <Card loading title="تحميل الحساب"/>}
  </div></ConfigProvider>;
}
function HomeByRole() {
  const [admin,setAdmin] = useState<boolean|null>(null);
  useEffect(()=>{let active=true;void isShopAdmin().then(v=>{if(active)setAdmin(v);});return ()=>{active=false;};},[]);
  return admin===null?<Card loading style={{margin:24}}/>:admin?<Dashboard/>:<CustomerDashboard/>;
}
function Dashboard() {
  const { mutate: logout } = useLogout();
  const validPages = new Set(["home","flexy","idoom","store","operations","cards","inventory","customers","devices","stations","members","ads","settings"]);
  const readPage = () => { const value = new URLSearchParams(window.location.hash.split("?")[1] || "").get("page"); return value && validPages.has(value) ? value : "home"; };
  const [page, setPageState] = useState(readPage);
  const setPage = (next: string) => {
    const safe = validPages.has(next) ? next : "home";
    setPageState(safe);
    const base = window.location.hash.split("?")[0] || "#/";
    window.history.replaceState(null, "", base + (safe === "home" ? "" : "?page=" + encodeURIComponent(safe)));
  };
  useEffect(() => {
    const sync = () => setPageState(readPage());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const screens = Grid.useBreakpoint();
  const mobile = !screens.md;
  const menu = <Menu aria-label="أقسام لوحة الإدارة" mode="inline" selectedKeys={[page]} items={items} onClick={({ key }) => { setPage(key); setDrawer(false); }} />;
  return <ConfigProvider direction="rtl" theme={{ token: { colorPrimary: "#2563eb", borderRadius: 10 } }}>
    <Layout className="app-layout" dir="rtl">
      {!mobile && <Sider width={242} collapsedWidth={76} collapsed={collapsed} theme="light" className="app-sider">
        <div className="brand">{collapsed ? "⚡" : "⚡ فليكسي ميني"}</div><Button className="collapse-button" type="text" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "توسيع القائمة" : "تصغير القائمة"}>{collapsed ? "⇤" : "⇥"}</Button>{menu}
      </Sider>}
      <Drawer title="⚡ فليكسي ميني" placement="right" open={mobile && drawer} onClose={() => setDrawer(false)} width={260}>{menu}</Drawer>
      <Layout>
        <Header className="app-header">
          <Space>
            {mobile && <Button onClick={() => setDrawer(true)} aria-label="فتح القائمة">☰</Button>}
            <Text strong>Flexy Mini</Text>
          </Space>
          <Space><Tag color={client ? "green" : "blue"}>v0.9.2 · {client ? "دخول الإدارة" : "إعداد الاتصال مطلوب"}</Tag>{client && <Button size="small" onClick={() => logout()}>خروج</Button>}</Space>
        </Header>
        <Content className="app-content">
          {page !== "home" && <div className="page-heading"><Title level={mobile ? 3 : 2}>{names[page]}</Title></div>}
          {page === "home" ? <>
            {client && <div style={{marginBottom:18}}><AdSystem db={client}/></div>}
            {client && <AdminWallet db={client}/>}

            <Title level={4} style={{ marginBottom: 16 }}>الخدمات</Title>
            <Row gutter={[12, 12]}>
              {[
                { title: "الفليكسي", subtitle: "عمليات الشحن", color: "#f0523b", target: "flexy", symbol: "↗" },
                { title: "تعبئة إيدوم", subtitle: "خدمات الإنترنت", color: "#41b95a", target: "idoom", symbol: "◎" },
                { title: "بطاقات رقمية", subtitle: "ألعاب، اتصالات وبرامج", color: "#625ee8", target: "store", symbol: "▣" }
              ].map(service => <Col xs={24} md={8} key={service.title}><div onClick={() => setPage(service.target)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter") setPage(service.target); }} style={{ background: service.color, borderRadius: 14, color: "white", padding: "22px 20px", minHeight: 112, cursor: "pointer", boxShadow: "0 6px 15px rgba(0,0,0,.08)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 20, fontWeight: 700 }}>{service.title}</span><span style={{ fontSize: 27 }}>{service.symbol}</span></div><div style={{ opacity: .9, marginTop: 9 }}>{service.subtitle}</div></div></Col>)}
            </Row>
          </> : page === "ads" && client ? <AdSystem db={client} admin /> : page === "settings" ? <ConnectionDiagnostics /> : page === "devices" ? <TrustedDevices /> : page === "customers" ? <MasterCustomerLookup /> : page === "members" ? <><MiniMembers />{client&&<CreditAdmin db={client}/>}</> : page === "cards" ? <CardsCatalog /> : page === "operations" ? <Card title="عملياتي"><Empty description="سجل عمليات حسابك لم يُفعّل بعد" /></Card> : <Card title={names[page]}><Empty description="الخدمة قيد التجهيز" /></Card>}
          <div className="app-footer">Flexy Mini · Refine + Ant Design · عرض تجريبي فقط</div>
        </Content>
        <nav className="bottom-service-nav" aria-label="خدمات الموقع" dir="rtl">
          {[
            {key:"flexy",label:"فليكسي",symbol:"▣"},
            {key:"idoom",label:"تعبئة إيدوم",symbol:"◎"},
            {key:"home",label:"الرئيسية",symbol:"⌂"},
            {key:"store",label:"البطاقات",symbol:"▤"},
            {key:"operations",label:"العمليات",symbol:"◷"}
          ].map(item=><Button key={item.key} type="text" className={page===item.key?"service-nav-active":""} onClick={()=>setPage(item.key)}><span className="service-nav-icon">{item.symbol}</span><span>{item.label}</span></Button>)}
        </nav>
      </Layout>
    </Layout>
  </ConfigProvider>;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Refine routerProvider={routerProvider} authProvider={authProvider} dataProvider={client ? dataProvider(client) : undefined}
        liveProvider={client ? liveProvider(client) : undefined}
        resources={[]} options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}>
        <Routes>
          <Route path="/customer-login" element={<TableCustomerLogin />} />
          <Route path="/login" element={client ? <LoginPage /> : <Alert type="error" showIcon message="التطبيق غير مهيأ للاتصال. لا يمكن الدخول قبل إعداد Supabase." />} />
          <Route path="/" element={client ? <Authenticated key="protected" fallback={<LoginPage />}><HomeByRole /></Authenticated> : <Alert type="error" showIcon message="الاتصال غير مهيأ. تم تعطيل وضع المعاينة المفتوح." />} />
        </Routes>
      </Refine>
    </HashRouter>
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/flexy-mini/sw.js", { scope: "/flexy-mini/" }).catch((error: unknown) => console.warn("PWA service worker registration failed", error));
  });
}
