import React, { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Authenticated, Refine, useLogin, useLogout } from "@refinedev/core";
import type { AuthProvider } from "@refinedev/core";
import { AuthPage } from "@refinedev/antd";
import { HashRouter, Route, Routes, Navigate } from "react-router";
import routerProvider from "@refinedev/react-router";
import { createClient } from "@supabase/supabase-js";
import { dataProvider, liveProvider } from "@refinedev/supabase";

import { ConfigProvider, Form, Input, Layout, Menu, Typography, Card, Row, Col, Table, Tag, Button, Space, Alert, Grid, Drawer, Empty, Descriptions, Select, Checkbox, Divider, Modal, message } from "antd";
import { HomeOutlined, PhoneOutlined, WifiOutlined, AppstoreOutlined, HistoryOutlined, DatabaseOutlined, PlusOutlined, UserOutlined, SafetyCertificateOutlined, DesktopOutlined, TeamOutlined, NotificationOutlined, SettingOutlined, ArrowUpOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import "antd/dist/reset.css";
import "./style.css";
const AdSystem = React.lazy(() => import("./AdSystem"));
const AdminWallet = React.lazy(() => import("./AdminWallet"));
const SupplierSites = React.lazy(() => import("./SupplierSites"));
const CreditAdmin = React.lazy(() => import("./CreditAdmin"));
const CardCodeImportAdmin = React.lazy(() => import("./CardCodeImportAdmin"));
const StationOverview = React.lazy(() => import("./StationOverview"));
const FlexyServicePage = React.lazy(() => import("./FlexyServicePage"));
import BuildCopyButton from "./BuildCopyButton";
import StartupDiagnostics from "./StartupDiagnostics";
import { supportPhone, supportWhatsApp } from "./settings";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://wqyebqzbbpohbnznqdjj.supabase.co";
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || "sb_publishable_gO4umNBMJ0AWRk19HtKd7A_9X4DibYj";
const client = url && key ? createClient(url, key, { auth: { storage: window.localStorage, persistSession: true, autoRefreshToken: true } }) : undefined;
// Use standard CORS headers only; Supabase Functions client adds x-client-info,
 // which is not currently allowed by this deployed Edge Function.
type CustomerRequestError = Error & {context?: Response};
async function customerAdminRequest(body: Record<string, unknown>): Promise<{data:any;error:CustomerRequestError|null}> {
  if (!client) return {data:null,error:new Error("Supabase unavailable")};
  try {
    const {data:{session}} = await client.auth.getSession();
    const response = await fetch(`${url}/functions/v1/flexy-mini-customers`, {
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":key,
        "Authorization":`Bearer ${session?.access_token || key}`},
      body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>null);
    return response.ok?{data,error:null}:{data,error:Object.assign(new Error(data?.error||"Request failed"),{context:response})};
  } catch(error) {
    return {data:null,error:error instanceof Error?error:new Error("Network error")};
  }
}
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
  const { mutate: adminLogin, isPending } = useLogin();
  const [loginError,setLoginError]=useState("");
  const [customerBusy,setCustomerBusy]=useState(false);
  const submit=async(values:{identifier:string;password:string},retryRevoked=false)=>{
    setLoginError("");
    const identifier=values.identifier.trim();
    if(identifier.includes("@")){adminLogin(values);return;}
    setCustomerBusy(true);
    try{
      const response=await fetch(url+"/functions/v1/flexy-mini-customers",{
        method:"POST",headers:{"Content-Type":"application/json",apikey:key},
        body:JSON.stringify({action:"login",identifier,password:values.password,device_secret:(()=>{const k="flexy_mini_device_secret";let v=retryRevoked?"":window.localStorage.getItem(k);if(!v){v=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");window.localStorage.setItem(k,v);}return v;})(),device_label:"متصفح الزبون"})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.token){
        if(!retryRevoked&&(data.code==="DEVICE_REVOKED"||(/إلغاء اعتماد هذا الجهاز|اعتماد هذا الجهاز ملغى|الجهاز ملغى/.test(String(data.error||""))))){await submit(values,true);return;}
        if(data.code==="DEVICE_PENDING"||(/تم تسجيل طلب اعتماد الجهاز|ينتظر الاعتماد/.test(String(data.error||"")))){setLoginError("تم إرسال طلب اعتماد جهازك إلى الإدارة. انتظر الموافقة ثم اضغط دخول مجددًا. لا تحذف التطبيق ولا تعِد التسجيل.");return;}
        setLoginError(data.error||"تعذر تسجيل الدخول. تحقق من بيانات الحساب.");return;
      }
      window.localStorage.setItem("flexy_mini_customer_token",data.token);
      window.location.hash="#/customer-login";
    }catch{setLoginError("تعذر الاتصال بخدمة دخول الزبائن. تحقق من الشبكة وحاول مجددًا.");}
    finally{setCustomerBusy(false);}
  };
  return <ConfigProvider direction="rtl" theme={{ token: { colorPrimary: "#2563eb" } }}>
    <div dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f6fa", padding: 16 }}>
      <Card title="⚡ فليكسي ميني — تسجيل الدخول" style={{ width: "100%", maxWidth: 420 }}>
        <Form layout="vertical" onFinish={values=>void submit(values)}>
          <Form.Item label="اسم المستخدم أو رقم الهاتف" name="identifier" rules={[{ required: true, message: "أدخل معرّف الحساب" }]}>
            <Input autoComplete="username" placeholder="اسم المستخدم أو رقم الهاتف" size="large" dir="ltr" />
          </Form.Item>
          <Form.Item label="كلمة المرور" name="password" rules={[{ required: true, message: "أدخل كلمة المرور" }]}>
            <Input.Password autoComplete="current-password" size="large" dir="ltr" />
          </Form.Item>
          {loginError&&<Alert type="error" showIcon style={{marginBottom:14}} message={loginError}/>}
          <Button htmlType="submit" type="primary" size="large" loading={isPending||customerBusy} block>دخول</Button>
        </Form>
        <Typography.Text type="secondary" style={{display:"block",marginTop:16,fontSize:12}}
          copyable={{text:String(import.meta.env.VITE_BUILD_SHA || "local")}}>
          نسخة الواجهة: {String(import.meta.env.VITE_BUILD_SHA || "local").slice(0,7)}
        </Typography.Text>
      </Card>
    </div>
  </ConfigProvider>;
}
const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const items = [
 {type:"group" as const,label:"الخدمات",children:[
  {key:"home",icon:<HomeOutlined/>,label:"الرئيسية"},
  {key:"flexy",icon:<PhoneOutlined/>,label:"فليكسي"},
  {key:"idoom",icon:<WifiOutlined/>,label:"تعبئة إيدوم"},
  {key:"store",icon:<AppstoreOutlined/>,label:"البطاقات"},
  {key:"operations",icon:<HistoryOutlined/>,label:"عملياتي"}
 ]},
 {type:"group" as const,label:"الإدارة",children:[
  {key:"cards",icon:<DatabaseOutlined/>,label:"إدارة البطاقات والأصناف"},
  {key:"inventory",icon:<PlusOutlined/>,label:"أكواد البطاقات"},
  {key:"customers",icon:<UserOutlined/>,label:"الزبائن"},
  {key:"devices",icon:<SafetyCertificateOutlined/>,label:"الأجهزة الموثوقة"},
  {key:"wallets",icon:<DatabaseOutlined/>,label:"المحافظ"},
  {key:"stations",icon:<DesktopOutlined/>,label:"المحطات والشرائح"},
  {key:"supplier-sites",icon:<AppstoreOutlined/>,label:"مواقع الموردين"},
  {key:"members",icon:<TeamOutlined/>,label:"المستخدمون والصلاحيات"},
  {key:"ads",icon:<NotificationOutlined/>,label:"إدارة الإعلانات"},
  {key:"settings",icon:<SettingOutlined/>,label:"الإعدادات"}
 ]}
];
const names:Record<string,string>={wallets:"المحافظ",devices:"الأجهزة الموثوقة",home:"الرئيسية",flexy:"الفليكسي",idoom:"تعبئة إيدوم",store:"متجر البطاقات",operations:"العمليات",cards:"إدارة البطاقات والأصناف",inventory:"إضافة أكواد البطاقات",customers:"إدارة الزبائن",stations:"المحطات والشرائح","supplier-sites":"مواقع الموردين",members:"المستخدمون والصلاحيات",ads:"إدارة الإعلانات",settings:"الإعدادات"};
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
    {error && <Alert type="warning" showIcon message={error} style={{ marginBottom: 16 }} />}
    <Table loading={loading} rowKey="id" dataSource={members} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 430 }} columns={[
      { title: "معرّف الماستر", dataIndex: "party_id" },
      { title: "الدور", dataIndex: "role" },
      { title: "الحالة", dataIndex: "active", render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "مفعّل" : "غير مفعّل"}</Tag> }
    ]} />
  </Card>;
}

type CatalogCategory = { id: number; name: string; sort_index: number; active: boolean };
type CatalogProduct = { id: number; category_id: number; name: string; sort_index: number; active: boolean; display_mode: string; is_frozen: boolean };
type CatalogVariant = { id: number; product_id: number; name: string; denomination: number | null; purchase_price: number; markup_percent: number; sort_index: number; active: boolean; display_mode: string; stock_quantity: number; is_frozen: boolean };
function CardsCatalog() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<{id:number;name:string}|null>(null);
  const [pendingProductDelete, setPendingProductDelete] = useState<{id:number;name:string}|null>(null);
  const [categoryForm] = Form.useForm();
  const [productForm] = Form.useForm();
  const [variantForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editingVariant, setEditingVariant] = useState<CatalogVariant | null>(null);
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
    if (table === "flexy_mini_products") {
      const name = String(payload.name || "").trim();
      if (products.some(p => p.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
        setError("اسم النوع «" + name + "» مسجل مسبقًا. لا يمكن تكرار الاسم.");
        return;
      }
    }
    setBusy(true);
    const { error } = await client.from(table).insert(payload);
    setBusy(false);
    if (error) { setError(error.code === "23505" ? "هذا الاسم مسجل مسبقًا، اختر اسمًا مختلفًا." : error.message); return; }
    form.resetFields();
    await refresh();
  }
  function deleteCategory(id: number, name: string) {
    if (!client || busy) return;
    if (products.some(p => p.category_id === id)) {
      setError("لا يمكن حذف القسم «" + name + "» لأنه يحتوي على أنواع.");
      return;
    }
    setPendingCategoryDelete({id,name});
  }
  async function confirmCategoryDelete() {
    if (!client || !pendingCategoryDelete || busy) return;
    const {id,name}=pendingCategoryDelete;
    setBusy(true);
    try {
      const {data,error}=await client.from("flexy_mini_categories").delete().eq("id",id).select("id");
      if(error) {setError("فشل حذف «"+name+"»: "+error.message);return;}
      if(!data?.some(row=>row.id===id)) {
        setError("لم يتم حذف «"+name+"». قد تكون صلاحية الحذف مرفوضة في Supabase.");
        return;
      }
      setPendingCategoryDelete(null);
      if(categoryId===id){setCategoryId(null);setProductId(null);}
      message.success("تم حذف القسم «"+name+"»");
      await refresh();
    } catch(e) {
      setError("تعذر حذف القسم: "+String(e));
    } finally {setBusy(false);}
  }
  async function confirmProductDelete() {
    if (!client || !pendingProductDelete || busy) return;
    const {id,name}=pendingProductDelete;
    if (variants.some(v=>v.product_id===id)) {
      setError("لا يمكن حذف النوع «"+name+"» لأنه يحتوي على بطاقات.");
      return;
    }
    setBusy(true);
    try {
      const {data,error}=await client.from("flexy_mini_products").delete().eq("id",id).select("id");
      if(error){setError("فشل حذف النوع: "+error.message);return;}
      if(!data?.some(row=>row.id===id)){setError("لم يُحذف النوع. تحقق من صلاحيات قاعدة البيانات.");return;}
      setPendingProductDelete(null);
      if(productId===id)setProductId(null);
      message.success("تم حذف النوع «"+name+"»");
      await refresh();
    } finally {setBusy(false);}
  }
  async function toggleVisibility(table: "flexy_mini_products" | "flexy_mini_variants", id: number, mode: string) {
    if (!client || busy) return;
    setError("");
    setBusy(true);
    try {
      const nextMode = mode === "hidden" ? "visible" : "hidden";
      const { data, error } = await client.from(table)
        .update({ display_mode: nextMode }).eq("id", id)
        .select("id,display_mode");
      if (error) { setError("تعذر تغيير الحالة: " + error.message); return; }
      if (!data?.some(row => row.id === id && row.display_mode === nextMode)) {
        setError("لم يتم حفظ تغيير الحالة. تحقق من صلاحيات الإدارة أو أعد المحاولة.");
        return;
      }
      if (table === "flexy_mini_variants") {
        setVariants(current => current.map(v => v.id === id ? { ...v, display_mode: nextMode } : v));
      } else {
        setProducts(current => current.map(p => p.id === id ? { ...p, display_mode: nextMode } : p));
      }
      message.success(nextMode === "hidden" ? "تم إخفاء البطاقة" : "تم إظهار البطاقة");
    } catch (e) {
      setError("تعذر الاتصال لحفظ الحالة: " + String(e));
    } finally { setBusy(false); }
  }
  async function toggleFreeze(table: "flexy_mini_products" | "flexy_mini_variants", id: number, frozen: boolean) {
    if (!client || busy) return;
    setBusy(true);
    const { data, error } = await client.from(table).update({ is_frozen: !frozen }).eq("id", id).select("id,is_frozen");
    setBusy(false);
    if (error || !data?.some(row => row.id === id && row.is_frozen === !frozen)) {
      setError("تعذر حفظ حالة التجميد: " + (error?.message || "لم يتم تأكيد الحفظ"));
      return;
    }
    if (table === "flexy_mini_variants") setVariants(old => old.map(v => v.id === id ? {...v,is_frozen:!frozen} : v));
    else setProducts(old => old.map(p => p.id === id ? {...p,is_frozen:!frozen} : p));
    message.success(!frozen ? "تم التجميد" : "تم إلغاء التجميد");
  }
  function syncCardPrices(form: ReturnType<typeof Form.useForm>[0], changed: Record<string, unknown>, values: Record<string, unknown>) {
    const key = Object.keys(changed)[0];
    if (!["purchase_price","sale_price","markup_percent"].includes(key)) return;
    const buy = Number(values.purchase_price);
    const sale = Number(values.sale_price);
    const percent = Number(values.markup_percent);
    if (!Number.isFinite(buy) || buy <= 0) return;
    if (key === "sale_price" && values.sale_price !== "" && Number.isFinite(sale) && sale >= 0) {
      form.setFieldsValue({markup_percent: Number(((sale / buy - 1) * 100).toFixed(4))});
    } else if (key === "markup_percent" && values.markup_percent !== "" && Number.isFinite(percent)) {
      form.setFieldsValue({sale_price: Number((buy * (1 + percent / 100)).toFixed(2))});
    } else if (key === "purchase_price") {
      if (values.sale_price !== undefined && values.sale_price !== "" && Number.isFinite(sale) && sale >= 0) {
        form.setFieldsValue({markup_percent: Number(((sale / buy - 1) * 100).toFixed(4))});
      } else if (Number.isFinite(percent)) {
        form.setFieldsValue({sale_price: Number((buy * (1 + percent / 100)).toFixed(2))});
      }
    }
  }
  async function updateVariant(values: Record<string, unknown>) {
    if (!client || !editingVariant || busy) return;
    setBusy(true);
    const payload = { name: String(values.name || "").trim(), denomination: Number(values.denomination), purchase_price: Number(values.purchase_price), markup_percent: Number(values.markup_percent), sort_index: Number(values.sort_index) };
    const { data, error } = await client.from("flexy_mini_variants").update(payload).eq("id", editingVariant.id).select("id");
    setBusy(false);
    if (error || !data?.some(row => row.id === editingVariant.id)) { setError("فشل تعديل البطاقة: " + (error?.message || "لم يتم تأكيد الحفظ")); return; }
    setEditingVariant(null);
    message.success("تم تحديث البطاقة");
    await refresh();
  }
  const visibleProducts = products.filter(p => p.category_id === categoryId && p.active);
  const visibleVariants = variants.filter(v => v.product_id === productId && v.active)
    .sort((a, b) => a.sort_index - b.sort_index || (a.denomination ?? 999999) - (b.denomination ?? 999999) || a.id - b.id);
  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <Modal open={editingVariant !== null} title="تعديل البطاقة" okText="حفظ التعديل" confirmLoading={busy} onOk={() => editForm.submit()} onCancel={() => !busy && setEditingVariant(null)} destroyOnHidden>
      <Form form={editForm} layout="vertical" onValuesChange={(changed,all)=>syncCardPrices(editForm,changed,all)} onFinish={updateVariant}>
        <Form.Item name="name" label="اسم البطاقة" rules={[{required:true}]}><Input /></Form.Item>
        <Form.Item name="denomination" label="القيمة" rules={[{required:true}]}><Input type="number" min={0}/></Form.Item>
        <Form.Item name="purchase_price" label="سعر الشراء (دج)" rules={[{required:true}]}><Input type="number" min={0} step="0.01"/></Form.Item>
        <Form.Item name="sale_price" label="سعر البيع (دج)"><Input type="number" min={0} step="0.01"/></Form.Item>
        <Form.Item name="markup_percent" label="نسبة الربح %" rules={[{required:true}]}><Input type="number" step="0.01"/></Form.Item>
        <Form.Item name="sort_index" label="الترتيب"><Input type="number"/></Form.Item>
      </Form>
    </Modal>
    <Modal open={pendingProductDelete!==null} title="تأكيد حذف النوع" okText="حذف نهائي" okButtonProps={{danger:true,loading:busy}} cancelText="إلغاء" onCancel={()=>{if(!busy)setPendingProductDelete(null);}} onOk={()=>void confirmProductDelete()}><Typography.Text>هل تريد حذف النوع «{pendingProductDelete?.name}» نهائيًا؟</Typography.Text></Modal>
    <Modal open={pendingCategoryDelete!==null} title="تأكيد حذف القسم" okText="حذف نهائي" okButtonProps={{danger:true,loading:busy}} confirmLoading={busy} cancelText="إلغاء" onCancel={()=>{if(!busy)setPendingCategoryDelete(null);}} onOk={()=>void confirmCategoryDelete()}><Typography.Text>هل تريد حذف القسم «{pendingCategoryDelete?.name}» نهائيًا؟</Typography.Text>{error&&<Alert type="error" showIcon message={error} style={{marginTop:12}}/>}</Modal>
    {error && <Alert type="error" showIcon message={error} closable onClose={() => setError("")} />}
    <Card title="1 — الأقسام" loading={busy && !categories.length}>
      <Space wrap>{categories.filter(c => c.active).map(c => <Space key={c.id} size={4}><Button type={categoryId === c.id ? "primary" : "default"} onClick={() => { setCategoryId(c.id); setProductId(null); }}>{c.name} <Tag style={{marginInlineStart:6}}>{products.filter(p=>p.category_id===c.id).length} أنواع</Tag></Button><Button size="small" danger disabled={busy || products.some(p=>p.category_id===c.id)} onClick={() => void deleteCategory(c.id,c.name)}>حذف</Button></Space>)}</Space>
      <Form form={categoryForm} layout="inline" style={{ marginTop: 16, gap: 8 }} onFinish={v => save("flexy_mini_categories", { name: v.name.trim(), sort_index: Number(v.sort_index || 0) }, categoryForm)}>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="اسم القسم" /></Form.Item>
        <Form.Item name="sort_index" initialValue={0}><Input type="number" placeholder="Index" style={{ width: 90 }} /></Form.Item>
        <Button htmlType="submit" type="primary" disabled={busy}>إضافة قسم</Button>
      </Form>
    </Card>
    {categoryId !== null && <Card title="2 — الأنواع">
      <Space wrap>{visibleProducts.map(p => <Space key={p.id} size={4}><Button type={productId === p.id ? "primary" : "default"} onClick={() => setProductId(current => current === p.id ? null : p.id)}>{p.name} <Tag style={{marginInlineStart:6}}>{variants.filter(v=>v.product_id===p.id).length} بطاقات</Tag></Button><Button size="small" aria-label={p.display_mode === "hidden" ? "إظهار" : "إخفاء"} title={p.display_mode === "hidden" ? "إظهار" : "إخفاء"} icon={p.display_mode === "hidden" ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => toggleVisibility("flexy_mini_products", p.id, p.display_mode)} /><Button size="small" disabled={busy} onClick={() => toggleFreeze("flexy_mini_products",p.id,p.is_frozen)}>{p.is_frozen ? "إلغاء التجميد" : "تجميد"}</Button><Button size="small" danger disabled={busy || variants.some(v=>v.product_id===p.id)} onClick={()=>setPendingProductDelete({id:p.id,name:p.name})}>حذف</Button></Space>)}</Space>
      <Form form={productForm} layout="inline" style={{ marginTop: 16, gap: 8 }} onFinish={v => save("flexy_mini_products", { category_id: categoryId, name: v.name.trim(), sort_index: Number(v.sort_index || 0) }, productForm)}>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="اسم النوع" /></Form.Item>
        <Form.Item name="sort_index" initialValue={0}><Input type="number" placeholder="Index" style={{ width: 90 }} /></Form.Item>
        <Button htmlType="submit" type="primary" disabled={busy}>إضافة نوع</Button>
      </Form>
    </Card>}
    {productId !== null && <Card id="mini-variants" title="3 — البطاقات">
      <Table<CatalogVariant> rowKey="id" dataSource={visibleVariants} size="small" pagination={{pageSize:10}} tableLayout="auto" expandable={{expandedRowRender:(v)=><Descriptions size="small" column={1} bordered items={[
        {key:"value",label:"القيمة",children:v.denomination ?? "—"},
        {key:"buy",label:"سعر الشراء",children:v.purchase_price+" دج"},
        {key:"margin",label:"الربح",children:v.markup_percent+"%"},
        {key:"sale",label:"سعر البيع",children:(Number(v.purchase_price)*(1+Number(v.markup_percent)/100)).toFixed(2)+" دج"},
        {key:"freeze",label:"التجميد",children:<Button size="small" disabled={busy} onClick={()=>toggleFreeze("flexy_mini_variants",v.id,v.is_frozen)}>{v.is_frozen?"إلغاء التجميد":"تجميد"}</Button>}
      ]}/>,rowExpandable:()=>true}} columns={[
        {title:"البطاقة",dataIndex:"name",key:"name",render:(name:string)=><span style={{overflowWrap:"anywhere"}}>{name}</span>},
        {title:"القيمة",dataIndex:"denomination",key:"denomination",width:85,responsive:["md"]},
        {title:"الشراء",dataIndex:"purchase_price",key:"purchase_price",width:100,responsive:["md"],render:(n:number)=>n+" دج"},
        {title:"الربح",dataIndex:"markup_percent",key:"markup_percent",width:85,responsive:["md"],render:(n:number)=>n+"%"},
        {title:"البيع",key:"sale",width:105,render:(_,v)=>(Number(v.purchase_price)*(1+Number(v.markup_percent)/100)).toFixed(2)+" دج"},
        {title:"المخزون",dataIndex:"stock_quantity",key:"stock",width:80},
        {title:"الإجراءات",key:"actions",width:92,render:(_,v)=><Space size={4}><Button size="small" title={v.display_mode==="hidden"?"إظهار":"إخفاء"} aria-label={v.display_mode==="hidden"?"إظهار":"إخفاء"} icon={v.display_mode==="hidden"?<EyeInvisibleOutlined/>:<EyeOutlined/>} onClick={()=>toggleVisibility("flexy_mini_variants",v.id,v.display_mode)}/><Button size="small" title="تعديل" aria-label="تعديل" icon={<SettingOutlined/>} onClick={()=>{setEditingVariant(v);editForm.setFieldsValue({name:v.name,denomination:v.denomination,purchase_price:v.purchase_price,markup_percent:v.markup_percent,sort_index:v.sort_index,sale_price:Number((Number(v.purchase_price)*(1+Number(v.markup_percent)/100)).toFixed(2))});}}/></Space>}
      ]} />
      <Form form={variantForm} layout="vertical" style={{ marginTop: 16 }} onValuesChange={(changed,all)=>syncCardPrices(variantForm,changed,all)} onFinish={v => save("flexy_mini_variants", { product_id: productId, name: v.name.trim(), denomination: Number(v.denomination || 0), purchase_price: Number(v.purchase_price), markup_percent: Number(v.markup_percent || 0), sort_index: Math.max(0, ...variants.filter(item => item.product_id === productId).map(item => Number(item.sort_index) || 0)) + 1 }, variantForm)}>
        <Row gutter={8}>
          <Col xs={24} sm={12}><Form.Item name="name" label="اسم البطاقة" rules={[{ required: true }]}><Input placeholder="مثلاً 60 UC" /></Form.Item></Col>
          <Col xs={12} sm={6}><Form.Item name="denomination" label="القيمة"><Input type="number" min={0} /></Form.Item></Col>
          
          <Col xs={12}><Form.Item name="purchase_price" label="سعر الشراء (دج)" rules={[{ required: true }]}><Input type="number" min={0} step="0.01" /></Form.Item></Col>
          <Col xs={12}><Form.Item name="sale_price" label="سعر البيع (دج)"><Input type="number" min={0} step="0.01" /></Form.Item></Col>
          <Col xs={12}><Form.Item name="markup_percent" label="نسبة الربح %" initialValue={0}><Input type="number" step="0.01" /></Form.Item></Col>
        </Row>
        <Button htmlType="submit" type="primary" disabled={busy}>إضافة بطاقة</Button>
      </Form>
    </Card>}
  </Space>;
}
function MasterCustomerLookup() {

  const [matches,setMatches]=useState<Array<{id:number;display_name:string;primary_phone?:string|null;primary_email?:string|null;mytool_username?:string|null;matchScore?:number}>>([]);
  const [selected,setSelected]=useState<number|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [creating,setCreating]=useState(false);
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [username,setUsername]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [saving,setSaving]=useState(false);
  const [savedMessage,setSavedMessage]=useState("");
  const [copyCredentials,setCopyCredentials]=useState("");
  const shareCredentials=async()=>{
    if(!copyCredentials)return;
    try{
      if(typeof navigator.share==="function"){await navigator.share({title:"بيانات الدخول إلى Flexy Mini",text:copyCredentials});return;}
      await navigator.clipboard.writeText(copyCredentials);
      message.info("المشاركة غير متاحة؛ تم نسخ البيانات");
    }catch(e){if(e instanceof Error&&e.name==="AbortError")return;message.error("تعذرت المشاركة؛ استعمل زر النسخ");}
  };
  const [saveFileOpen,setSaveFileOpen]=useState(false);
  const [filePassword,setFilePassword]=useState("");
  const [fileSaving,setFileSaving]=useState(false);
  const saveEncryptedFile=async()=>{
    if(filePassword.length<12){message.error("كلمة حماية الملف لازم تكون 12 حرفًا على الأقل");return;}
    if(!copyCredentials||!crypto.subtle){message.error("التشفير غير متاح في هذا المتصفح");return;}
    setFileSaving(true);
    try{
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const raw=await crypto.subtle.importKey("raw",new TextEncoder().encode(filePassword),"PBKDF2",false,["deriveKey"]);
      const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},raw,{name:"AES-GCM",length:256},false,["encrypt"]);
      const cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(copyCredentials)));
      const hex=(a:Uint8Array)=>Array.from(a).map(n=>n.toString(16).padStart(2,"0")).join("");
      const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>بيانات دخول Flexy Mini - ملف مشفر</title><body style="font:18px system-ui;max-width:540px;margin:40px auto;padding:16px"><h2>بيانات دخول Flexy Mini</h2><p>هذا الملف مشفر. أدخل كلمة حماية الملف لعرض بيانات الدخول.</p><input id="pw" type="password" placeholder="كلمة حماية الملف" style="padding:12px;width:90%"><button id="open" style="padding:12px;margin:12px 0">فتح الملف</button><pre id="out" dir="auto" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><script>const salt="${hex(salt)}",iv="${hex(iv)}",data="${hex(cipher)}";const bytes=h=>new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));document.getElementById("open").onclick=async()=>{const out=document.getElementById("out");out.textContent="جاري فك التشفير...";try{const raw=await crypto.subtle.importKey("raw",new TextEncoder().encode(document.getElementById("pw").value),"PBKDF2",false,["deriveKey"]);const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:bytes(salt),iterations:250000,hash:"SHA-256"},raw,{name:"AES-GCM",length:256},false,["decrypt"]);out.textContent=new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv)},key,bytes(data)));document.getElementById("pw").value="";window.setTimeout(()=>{out.textContent="تم إخفاء بيانات الدخول تلقائيًا بعد 60 ثانية. أدخل كلمة الحماية لفتحها مجددًا."},60000);}catch(e){out.textContent="كلمة الحماية غير صحيحة أو المتصفح لا يسمح بفك التشفير من ملف محلي. افتح الملف عبر اتصال HTTPS موثوق."}};<\/script></body></html>`;
      const blob=new Blob([html],{type:"text/html;charset=utf-8"});
      const href=URL.createObjectURL(blob);
      const link=document.createElement("a");link.href=href;link.download="flexy-mini-credentials-encrypted.html";document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(href),60000);
      setSaveFileOpen(false);setFilePassword("");message.success("تم تجهيز الملف المشفر");
    }catch{message.error("تعذر تشفير الملف");}
    finally{setFileSaving(false);}
  };
  const [editing,setEditing]=useState<{id:number;username:string}|null>(null);
  const [editUsername,setEditUsername]=useState("");
  const [editPassword,setEditPassword]=useState("");
  const [editError,setEditError]=useState("");
  const [editBusy,setEditBusy]=useState(false);
  const updateAccount=async()=>{
    if(!editing)return;
    if(!/^[a-z0-9_]{3,32}$/.test(editUsername.trim().toLowerCase())){setEditError("اسم المستخدم غير صالح");return;}
    if(editPassword&&editPassword.length<8){setEditError("كلمة المرور الجديدة لا تقل عن 8 أحرف");return;}
    setEditBusy(true);setEditError("");
    const {data,error}=await customerAdminRequest({action:"update_customer",customer_id:editing.id,username:editUsername.trim(),new_password:editPassword});
    setEditBusy(false);
    if(error||!data?.ok){setEditError(data?.error||error?.message||"تعذر حفظ التعديل");return;}
    if(editPassword)setCopyCredentials("اسم المستخدم: "+editUsername.trim()+"\nكلمة المرور الجديدة: "+editPassword);
    setSavedMessage("تم تحديث الحساب "+editUsername.trim()+(editPassword?" وتغيير كلمة المرور وإغلاق جلساته القديمة":""));
    setEditing(null);setEditPassword("");void loadAccounts();
  };
  const [accounts,setAccounts]=useState<Array<{id:number;party_id:number;username:string;phone:string;active:boolean}>>([]);
  const [masterRecord,setMasterRecord]=useState<{id:number;display_name:string;primary_phone?:string|null;mytool_username?:string|null}|null>(null);
  const assignMaster=(r:{id:number;display_name:string;primary_phone?:string|null;mytool_username?:string|null},overwrite=false)=>{
    setSelected(r.id);setMasterRecord(r);setError("");
    if(overwrite||name.trim()!==r.display_name)setName(r.display_name||"");
    const digits=(r.primary_phone||"").replace(/\D/g,"");
    const normalized=digits.startsWith("213")?"0"+digits.slice(3):digits;
    if(normalized)setPhone(normalized);
    const candidate=(r.mytool_username||"").trim();
    if(candidate&&!/^mt\d*_\d+$/i.test(candidate)&&(overwrite||!username.trim()))setUsername(candidate);
  };
  useEffect(()=>{
    if(!client)return;
    const terms=[username.trim(),phone.trim(),email.trim(),name.trim()].filter(v=>v.length>=3);
    if(!terms.length){setMatches([]);setBusy(false);return;}
    let active=true;
    const timer=window.setTimeout(async()=>{
      setBusy(true);
      const responses=await Promise.all(terms.map(term=>client!.rpc("admin_customer_master_search",{p_query:term,p_limit:10})));
      if(!active)return;
      const found=new Map<number,typeof matches[number]>();
      for(const response of responses){
        if(response.error)continue;
        for(const record of (Array.isArray(response.data)?response.data:[])){
          const r=record as typeof matches[number];
          const normalized=(v:string|null|undefined)=>(v||"").trim().toLowerCase();
          const score=(normalized(r.mytool_username)===normalized(username)&&username.length>=3?100:0)+(normalized(r.primary_phone)===normalized(phone)&&phone.length>=3?100:0)+(normalized(r.primary_email)===normalized(email)&&email.length>=3?100:0)+(normalized(r.display_name)===normalized(name)&&name.length>=3?80:0);
          const candidate={...r,matchScore:score};
          if(!found.has(r.id)||score>(found.get(r.id)?.matchScore||0))found.set(r.id,candidate);
        }
      }
      setMatches([...found.values()].sort((x,y)=>(y.matchScore||0)-(x.matchScore||0)).slice(0,10));
      setBusy(false);
    },450);
    return()=>{active=false;window.clearTimeout(timer);};
  },[username,phone,email,name]);
  const loadAccounts=async()=>{if(!client)return;const {data,error}=await customerAdminRequest({action:"list"});if(!error&&Array.isArray(data?.customers))setAccounts(data.customers);};
  useEffect(()=>{void loadAccounts();},[]);
  const createAccount=async()=>{
    if(!client||!username.trim()||(phone!==""&&!/^0[567][0-9]{8}$/.test(phone))){setError("أدخل اسم مستخدم صالحًا. الاسم والهاتف اختياريان");return;}
    if(!/^[a-z0-9_]{3,32}$/.test(username.trim().toLowerCase())){setError("اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا إنجليزيًا أو رقمًا أو _");return;}
    const generatedPassword = !password;
    const effectivePassword = password || Array.from(crypto.getRandomValues(new Uint8Array(8)), n => String((n % 8) + 1)).join("");
    setSaving(true);setError("");setSavedMessage("");
    const {data,error}=await customerAdminRequest(selected?{action:"create",party_id:selected,username:username.trim(),phone,email:email.trim(),password:effectivePassword}:{action:"create_with_master",name:name.trim(),username:username.trim(),phone,email:email.trim(),password:effectivePassword});
    setSaving(false);
    if(error||!data?.customer){
      let details=typeof data?.error==="string"?data.error:"";
      if(error&&"context" in error&&error.context instanceof Response){try{const payload=await error.context.clone().json();if(typeof payload?.error==="string")details=payload.error;}catch{/* Keep safe fallback. */}}
      const labels:Record<string,string>={"Invalid customer details":"الخادم رفض بيانات الحساب. تحقق من اسم المستخدم والهاتف وكلمة المرور.","Master not eligible":"الماستر المختار غير مؤهل للربط حاليًا.","Password service unavailable":"خدمة تشفير كلمة المرور غير متاحة.","Username, phone or Master already assigned":"اسم المستخدم أو الهاتف أو الماستر مرتبط بحساب آخر.","Creation failed":"فشل حفظ الحساب في قاعدة البيانات.","Master identity already exists; select existing Master":"الاسم أو الهاتف مرتبط بهوية ماستر موجودة. ابحث عنها واخترها.","Master creation failed":"تعذر إنشاء الماستر. تحقق من البيانات أو وجود سجل مكرر.","Master identity check unavailable":"تعذر التحقق من تكرار الهوية. حاول لاحقًا.","Unauthorized":"انتهت جلسة الإدارة؛ أعد تسجيل الدخول.","Admin only":"ليس لديك صلاحية إنشاء حساب."};
      setError((labels[details]||details||error?.message||"تعذر إنشاء الحساب")+(error?.context instanceof Response?" (HTTP "+error.context.status+")":""));return;
    }
    setSavedMessage((selected?"تم إنشاء الحساب: ":"تم إنشاء الماستر والحساب: ")+data.customer.username+(data.customer.phone?" — "+data.customer.phone:"")+(generatedPassword?" — كلمة المرور المولّدة: "+effectivePassword:""));
    setCopyCredentials("اسم المستخدم: "+data.customer.username+"\nكلمة المرور: "+effectivePassword);
    setPassword("");void loadAccounts();
  };
  return <Space direction="vertical" size="middle" style={{width:"100%"}}>
    <Card title="زبائن Flexy Mini" extra={<Button type="primary" onClick={()=>{if(!creating){setCopyCredentials("");setSavedMessage("");setPassword(Array.from(crypto.getRandomValues(new Uint8Array(8)), n => String((n % 8) + 1)).join(""));}setCreating(v=>!v);}}>{creating?"إغلاق":"زبون جديد +"}</Button>}>
      {savedMessage&&<Alert type="success" style={{marginTop:12}} message={savedMessage}/>}
      {copyCredentials&&<Space wrap style={{marginTop:10}}>
        <Button type="primary" onClick={()=>{void navigator.clipboard.writeText(copyCredentials).then(()=>message.success("تم نسخ بيانات الدخول")).catch(()=>message.error("تعذر النسخ"));}}>نسخ بيانات الدخول</Button>
        <Button onClick={()=>void shareCredentials()}>مشاركة بيانات الدخول</Button>
        <Button onClick={()=>setSaveFileOpen(true)}>حفظ ملف مشفر</Button>
      </Space>}
      <Modal title="حفظ بيانات الدخول كملف مشفر" open={saveFileOpen} onCancel={()=>{setSaveFileOpen(false);setFilePassword("");}} onOk={()=>void saveEncryptedFile()} okText="تشفير وحفظ الملف" okButtonProps={{disabled:filePassword.length<12}} confirmLoading={fileSaving} cancelText="إلغاء">
        <p>اختر كلمة حماية مستقلة من 12 حرفًا على الأقل. بدونها لا يمكن فتح بيانات الدخول. لا تُرسل كلمة الحماية مع الملف في نفس الرسالة.</p>
        <Input.Password autoComplete="new-password" value={filePassword} onChange={e=>setFilePassword(e.target.value)} placeholder="كلمة حماية الملف"/>
        <Text type="secondary">قد تمنع بعض المتصفحات فك التشفير عند فتح ملف HTML محليًا؛ يمكن فتحه في متصفح يسمح بالتشفير المحلي.</Text>
      </Modal>
      <Modal title="تعديل حساب الزبون" open={!!editing} onCancel={()=>{setEditing(null);setEditPassword("");setEditError("");}} onOk={()=>void updateAccount()} okText="حفظ التعديل" confirmLoading={editBusy} cancelText="إلغاء">
        <Form layout="vertical">
          <Form.Item label="اسم المستخدم"><Input dir="ltr" value={editUsername} onChange={e=>setEditUsername(e.target.value)}/></Form.Item>
          <Form.Item label="كلمة مرور جديدة (اختياري — لا تحتاج القديمة)"><Input.Password autoComplete="new-password" value={editPassword} onChange={e=>setEditPassword(e.target.value)} placeholder="اتركها فارغة للإبقاء على الحالية"/></Form.Item>
          {editError&&<Alert type="error" message={editError}/>}
          <Text type="secondary">عند تغيير كلمة المرور تُغلق جلسات الزبون السابقة.</Text>
        </Form>
      </Modal>
      <Table size="small" rowKey="id" style={{marginTop:12}} dataSource={accounts.map(a=>({...a,name:a.phone,master:a.party_id,status:a.active?"نشط":"معطل"}))} columns={[
        {title:"الزبون",dataIndex:"name"},
        {title:"اسم المستخدم",dataIndex:"username"},
        {title:"الماستر",dataIndex:"master"},
        {title:"الحالة",dataIndex:"status"},{title:"إدارة",key:"edit",render:(_:unknown,record:{id:number;username:string})=><Button size="small" onClick={()=>{setEditing({id:record.id,username:record.username});setEditUsername(record.username);setEditPassword("");setEditError("");}}>تعديل</Button>}
      ]} locale={{emptyText:"لا توجد حسابات Flexy Mini مؤكدة بعد"}}/>
    </Card>
    {creating&&<Card title="زبون جديد — مطابقة الماستر">
      <Form layout="vertical" style={{marginTop:14}}>
        <Form.Item label="اسم المستخدم" validateStatus={username&&!/^[a-z0-9_]{3,32}$/.test(username.trim().toLowerCase())?"error":undefined} help={username&&!/^[a-z0-9_]{3,32}$/.test(username.trim().toLowerCase())?"اسم المستخدم من 3 إلى 32 حرفًا إنجليزيًا أو رقمًا أو _":undefined}><Input dir="ltr" value={username} onChange={e=>{setUsername(e.target.value);setSelected(null);setMasterRecord(null);}} placeholder="username"/></Form.Item>
        <Form.Item label="كلمة المرور (مولّدة تلقائيًا — يمكنك تعديلها)"><Input.Password value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></Form.Item>
        <Divider orientation="right">بيانات الزبون (اختيارية)</Divider>
        <Form.Item label="رقم الهاتف" validateStatus={phone&&!/^0[567][0-9]{8}$/.test(phone)?"error":undefined} help={phone&&!/^0[567][0-9]{8}$/.test(phone)?"أدخل رقمًا جزائريًا صحيحًا أو اترك الخانة فارغة":undefined}><Input dir="ltr" value={phone} onChange={e=>{setPhone(e.target.value.replace(/[^0-9+]/g,""));setSelected(null);setMasterRecord(null);}} placeholder="0XXXXXXXXX"/></Form.Item>
        <Form.Item label="البريد الإلكتروني"><Input dir="ltr" type="email" value={email} onChange={e=>{setEmail(e.target.value);setSelected(null);setMasterRecord(null);}} placeholder="example@email.com"/></Form.Item>
        <Form.Item label="اسم الزبون"><Input value={name} onChange={e=>{setName(e.target.value);setSelected(null);setMasterRecord(null);}} placeholder="الاسم الكامل"/></Form.Item>
      </Form>
      {error&&<Alert type="warning" message={error}/>}
      {busy&&<Text type="secondary">جاري فحص تطابق الماستر...</Text>}
      {!busy&&matches.length>0&&<Alert type="info" showIcon message="مطابقات محتملة"/>}
      {!busy&&matches.length===0&&<Alert type="info" message="لا توجد مطابقة"/>}
      <Space direction="vertical" size="small" style={{width:"100%",marginTop:12}}>
        {matches.map(r=><Card key={r.id} size="small" style={{borderColor:selected===r.id?"#1677ff":undefined}}>
          <Space direction="vertical" size="small" style={{width:"100%"}}>
            <Text strong>{r.display_name}</Text>
            <Text type="secondary">الهاتف: <span dir="ltr">{r.primary_phone||"غير مسجل"}</span></Text>
            {r.mytool_username&&<Text type="secondary">المستخدم: <span dir="ltr">{r.mytool_username}</span></Text>}
            <Text type="secondary">{r.matchScore&&r.matchScore>=80?"تطابق مباشر في بيانات الهوية":"تشابه محتمل — راجع البيانات"}</Text>
            {selected===r.id?<Button onClick={()=>{setSelected(null);setMasterRecord(null);}}>✓ ماستر محدد — إلغاء الاختيار</Button>:<Button block onClick={()=>assignMaster(r)}>ربط بهذا الماستر</Button>}
          </Space>
        </Card>)}
      </Space>
      {selected&&<Alert style={{marginTop:12}} type="success" message="الماستر محدد"/>}
      <Button style={{marginTop:12}} type="primary" loading={saving} disabled={saving||busy} onClick={()=>void createAccount()}>{selected?"حفظ الزبون وإنشاء الحساب":"إنشاء ماستر جديد وربط الحساب"}</Button>
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
  return <Space direction="vertical" style={{width:"100%"}}><StartupDiagnostics/><Card title="فحص اتصال Supabase" className="section-card">
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
  </Card></Space>;
}
type TrustedDevice={id:number;customer_id:number;device_label:string;approved_at:string|null;revoked_at:string|null;expires_at:string|null;created_at:string;last_used_at:string|null;flexy_mini_customer_accounts:{username:string;phone:string;money_party_directory:{display_name:string}}};
type MiniWalletRow={customer_id:number;username:string;phone:string;active:boolean;wallet:{balance:number;debt:number;profit:number}|null};
function MiniWalletAdmin(){
 const [rows,setRows]=useState<MiniWalletRow[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [selected,setSelected]=useState<MiniWalletRow|null>(null),[history,setHistory]=useState<any[]>([]);
 const [searchWallet,setSearchWallet]=useState("");
 const [kind,setKind]=useState("deposit"),[amount,setAmount]=useState(""),[note,setNote]=useState("");
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const [postingEnabled,setPostingEnabled]=useState(false);
 const load=async()=>{setBusy(true);try{const {data,error}=await customerAdminRequest({action:"wallets"});if(error||!data?.wallets)throw new Error(data?.error||"تعذر تحميل المحافظ");setRows(data.wallets);setPostingEnabled(false);setError("");}catch(e){setError(String(e));}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
 const show=async(r:MiniWalletRow)=>{setSelected(r);setHistory([]);const {data,error}=await customerAdminRequest({action:"wallet_history",customer_id:r.customer_id});if(error)setError("تعذر تحميل السجل");else setHistory(data?.entries||[]);};
 const post=async()=>{if(!selected)return;const value=Number(amount);if(!Number.isFinite(value)||value<=0||Math.round(value*100)!==value*100){message.error("أدخل مبلغًا صحيحًا");return;}setBusy(true);try{const {data,error}=await customerAdminRequest({action:"wallet_post",customer_id:selected.customer_id,kind,amount:value,note,request_id:requestId});if(error||!data?.wallet)throw new Error(data?.error||"فشلت الحركة");message.success("تم تسجيل الحركة");setAmount("");setNote("");setRequestId(crypto.randomUUID());await load();await show(selected);}catch(e){message.error(String(e));}finally{setBusy(false);}};
 const money=(n:unknown)=>Number(n||0).toLocaleString("ar-DZ")+" دج";
 return <Card title="محافظ الزبائن" extra={<Button loading={busy} onClick={()=>void load()}>تحديث</Button>}>
 {error&&<Alert type="error" message={error} style={{marginBottom:12}}/>}
 <Input.Search placeholder="ابحث بالاسم أو الهاتف" value={searchWallet} onChange={e=>setSearchWallet(e.target.value)} style={{marginBottom:12}}/>
 <Table rowKey="customer_id" loading={busy} dataSource={rows.filter(r=>(r.username+" "+r.phone).toLowerCase().includes(searchWallet.toLowerCase()))} pagination={{pageSize:10}} scroll={{x:950}} columns={[
 {title:"الزبون",dataIndex:"username"},{title:"الهاتف",dataIndex:"phone"},{title:"حالة الحساب",render:(_,r)=><Tag color={r.active?"green":"default"}>{r.active?"نشط":"معطل"}</Tag>},
 {title:"الرصيد",render:(_,r)=>r.wallet?money(r.wallet.balance):"لم تُفتح"},
 {title:"الديون",render:(_,r)=>r.wallet?money(r.wallet.debt):"—"},
 {title:"الأرباح",render:(_,r)=>r.wallet?money(r.wallet.profit):"—"},
 {title:"الإجراءات",render:(_,r)=><Button onClick={()=>void show(r)}>المحفظة والسجل</Button>}
 ]}/>
 <Modal title={selected?"تفاصيل الزبون: "+selected.username:"تفاصيل الزبون"} open={!!selected} onCancel={()=>setSelected(null)} footer={null} width={720}>
 {selected&&<Space direction="vertical" style={{width:"100%"}}>
 <Descriptions bordered size="small" column={1} items={[{key:"user",label:"اسم المستخدم",children:selected.username},{key:"phone",label:"الهاتف",children:selected.phone},{key:"status",label:"الحالة",children:selected.active?"نشط":"معطل"},{key:"balance",label:"الرصيد",children:selected.wallet?money(selected.wallet.balance):"لم تُفتح"},{key:"debt",label:"الديون",children:selected.wallet?money(selected.wallet.debt):"—"},{key:"profit",label:"الأرباح",children:selected.wallet?money(selected.wallet.profit):"—"}]}/>
 <Alert type="warning" message="التسجيل المالي غير مفعّل"/>
 <Select value={kind} onChange={setKind} style={{width:"100%"}} options={[{value:"deposit",label:"إيداع رصيد"},{value:"withdrawal",label:"سحب رصيد"},{value:"debt_increase",label:"زيادة دين"},{value:"debt_payment",label:"تسديد دين"},{value:"profit_credit",label:"إضافة أرباح"}]}/>
 <Input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="المبلغ بالدينار" inputMode="decimal"/>
 <Input value={note} onChange={e=>setNote(e.target.value)} placeholder="سبب الحركة / مرجع العملية"/>
 <Button type="primary" loading={busy} disabled={!postingEnabled||!amount||!note.trim()} onClick={()=>Modal.confirm({title:"تأكيد الحركة المالية",content:"الزبون: "+selected.username+" — المبلغ: "+amount+" دج. هل تؤكد التسجيل؟",okText:"تأكيد",cancelText:"إلغاء",onOk:()=>post()})}>تسجيل الحركة</Button>
 <Typography.Title level={5}>آخر الحركات</Typography.Title>
 <Table size="small" rowKey="id" dataSource={history} pagination={{pageSize:5}} scroll={{x:500}} columns={[{title:"التاريخ",render:(_,r)=>new Date(r.created_at).toLocaleString("ar-DZ")},{title:"النوع",dataIndex:"kind"},{title:"الرصيد بعد",render:(_,r)=>money(r.balance_after)},{title:"الدين بعد",render:(_,r)=>money(r.debt_after)},{title:"ملاحظة",dataIndex:"note"}]}/>
 </Space>}
 </Modal></Card>;
}
function TrustedDevices(){
  const [view,setView]=useState<"pending"|"approved"|"history">("approved");
  const [kinds,setKinds]=useState<Record<number,string>>({});
  const [devices,setDevices]=useState<TrustedDevice[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const load=async()=>{setBusy(true);try{const {data,error}=await customerAdminRequest({action:"devices"});if(error||!data?.devices)throw new Error(data?.error||"تعذر تحميل الأجهزة");setDevices(data.devices);}catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال");}finally{setBusy(false);}};
  useEffect(()=>{void load();},[]);
  const change=async(id:number,action:string)=>{setBusy(true);setError("");try{const {data,error}=await customerAdminRequest({action,device_id:id,device_kind:kinds[id]||"desktop"});if(error){let message=data?.error;try{if(error.context)message=(await error.context.clone().json()).error;}catch{}throw new Error(message||error.message||"تعذر تحديث الجهاز");}await load();}catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال");}finally{setBusy(false);}};
  const state=(d:TrustedDevice)=>d.revoked_at?"ملغى":!d.approved_at?"بانتظار الاعتماد":new Date(d.expires_at||0).getTime()<=Date.now()?"منتهي":"معتمد";
  const pendingCount=devices.filter(d=>state(d)==="بانتظار الاعتماد").length;
  useEffect(()=>{if(!busy&&view==="pending"&&pendingCount===0)setView("approved");},[busy,view,pendingCount]);
  const visibleDevices=devices.filter(d=>(view==="pending"?state(d)==="بانتظار الاعتماد":view==="approved"?state(d)==="معتمد":state(d)==="ملغى"||state(d)==="منتهي"));
  return <Card title="الأجهزة الموثوقة" extra={<Button loading={busy} onClick={()=>void load()}>تحديث</Button>}>
    <Alert type="info" message="جهازان لكل زبون · الكمبيوتر 7 أيام · الهاتف 30 يومًا" style={{marginBottom:12}}/>
    {error&&<Alert type="error" message={error} style={{marginBottom:12}}/>}
    <Space direction="vertical" style={{width:"100%",marginBottom:16}}>{pendingCount>0&&<Button block type={view==="pending"?"primary":"default"} onClick={()=>setView("pending")}>طلبات الاعتماد ({pendingCount})</Button>}<Button block type={view==="approved"?"primary":"default"} onClick={()=>setView("approved")}>الأجهزة المعتمدة ({devices.filter(d=>state(d)==="معتمد").length})</Button><Button block type={view==="history"?"primary":"default"} onClick={()=>setView("history")}>سجل الأجهزة ({devices.filter(d=>["ملغى","منتهي"].includes(state(d))).length})</Button></Space>
    <Table rowKey="id" loading={busy} dataSource={visibleDevices} pagination={{pageSize:10}} scroll={{x:850}} columns={[
      {title:"الزبون",render:(_,d)=>d.flexy_mini_customer_accounts?.money_party_directory?.display_name||d.flexy_mini_customer_accounts?.username},
      {title:"المستخدم",render:(_,d)=>d.flexy_mini_customer_accounts?.username},
      {title:"الجهاز",render:(_,d)=>d.device_label+" #"+d.id},
      {title:"الحالة",render:(_,d)=><Tag color={state(d)==="معتمد"?"green":state(d)==="بانتظار الاعتماد"?"orange":"default"}>{state(d)}</Tag>},
      {title:"تاريخ الطلب",render:(_,d)=>new Date(d.created_at).toLocaleString("ar-DZ")},
      {title:"آخر استعمال",render:(_,d)=>d.last_used_at?new Date(d.last_used_at).toLocaleString("ar-DZ"):"لم يدخل بعد"},
      {title:"الإجراءات",render:(_,d)=><Space>{state(d)==="بانتظار الاعتماد"&&<Select value={kinds[d.id]||"desktop"} onChange={v=>setKinds({...kinds,[d.id]:v})} options={[{value:"desktop",label:"كمبيوتر · 7 أيام"},{value:"mobile",label:"هاتف · 30 يومًا"}]} />}{state(d)==="بانتظار الاعتماد"&&<Button disabled={busy} onClick={()=>void change(d.id,"approve_device")}>اعتماد الجهاز</Button>}{!d.revoked_at&&<Button danger disabled={busy} onClick={()=>void change(d.id,"revoke_device")}>إلغاء الاعتماد</Button>}</Space>}
    ]}/>
  </Card>;
}
function SharedCardsStore({token}:{token?:string}){
  type Category={id:number;name:string};
  type Product={id:number;category_id:number;name:string};
  type Variant={id:number;product_id:number;name:string;denomination:number|null;stock_quantity:number;sort_index?:number;is_frozen?:boolean};
  const [catalog,setCatalog]=useState<{categories:Category[];products:Product[];variants:Variant[]}|null>(null);
  const [error,setError]=useState("");
  const [selectedProduct,setSelectedProduct]=useState<number|null>(null);
  const [busy,setBusy]=useState(true);
  useEffect(()=>{
    let active=true;setBusy(true);
    if(!token){void (async()=>{if(!client)throw new Error("لا يوجد اتصال");const [p,v]=await Promise.all([client.from("flexy_mini_products").select("id,category_id,name,active,display_mode"),client.from("flexy_mini_variants").select("id,product_id,name,denomination,stock_quantity,sort_index,is_frozen,active,display_mode")]);if(p.error||v.error)throw new Error(p.error?.message||v.error?.message);return {categories:[],products:(p.data||[]).filter(x=>x.active&&x.display_mode==="visible"),variants:(v.data||[]).filter(x=>x.active&&x.display_mode==="visible")};})().then(data=>{if(active)setCatalog(data);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"تعذر تحميل البطاقات");}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};}
    void fetch(url+"/functions/v1/flexy-mini-customers",{method:"POST",headers:{"Content-Type":"application/json",apikey:key},body:JSON.stringify({action:"catalog",token})})
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"تعذر تحميل البطاقات");if(active)setCatalog(data);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"تعذر الاتصال");})
      .finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[token]);
  const brand=(name:string)=>{const n=name.toLowerCase();if(n.includes("mobilis"))return {label:"mobilis",color:"#4caf27"};if(n.includes("adsl")||n.includes("idoom"))return {label:"idoom",color:"#76509b"};if(n.includes("4g")||n.includes("lte"))return {label:"4G LTE",color:"#2452a4"};if(n.includes("djezzy"))return {label:"DJEZZY",color:"#d51f32"};if(n.includes("ooredoo"))return {label:"ooredoo",color:"#d92035"};if(n.includes("free fire"))return {label:"FREE FIRE",color:"#b35d18"};if(n.includes("pubg"))return {label:"PUBG",color:"#c38b18"};return {label:name,color:"#3d6da2"};};
  const products=catalog?.products||[];
  const chosen=products.find(p=>p.id===selectedProduct);
  return <div>
    {busy&&<Card loading/>}
    {error&&<Alert type="error" message={error}/>}
    {catalog&&<>
      <Typography.Title level={4}>بطاقات</Typography.Title>
      <Row gutter={[16,20]} justify="center">{products.map(product=>{const b=brand(product.name);const logo=(()=>{const n=product.name.toLowerCase();if(n.includes("mobilis"))return "https://upload.wikimedia.org/wikipedia/commons/8/89/Mobilis_Logo.svg";if(n.includes("ooredoo"))return "https://upload.wikimedia.org/wikipedia/commons/4/43/Ooredoo_logo.svg";if(n.includes("djezzy"))return "https://upload.wikimedia.org/wikipedia/commons/5/5b/Djezzy_logo.svg";return null;})();return <Col xs={8} sm={6} md={4} key={product.id}><div role="button" tabIndex={0} onClick={()=>setSelectedProduct(product.id)} onKeyDown={e=>{if(e.key==="Enter")setSelectedProduct(product.id);}} style={{cursor:"pointer",textAlign:"center"}}><div style={{aspectRatio:"1",borderRadius:15,background:logo?"#fff":b.color,color:"white",display:"grid",placeItems:"center",fontWeight:800,fontSize:b.label.length>9?13:19,boxShadow:"0 4px 12px rgba(0,0,0,.10)",padding:6,overflow:"hidden"}}>{logo?<><img src={logo} alt={product.name} loading="lazy" onError={e=>{e.currentTarget.style.display="none";const fallback=e.currentTarget.nextElementSibling as HTMLElement|null;if(fallback)fallback.style.display="block";}} style={{width:"92%",height:"80%",objectFit:"contain"}}/><span style={{display:"none",color:b.color,fontSize:15,fontWeight:800}}>{b.label}</span></>:b.label}</div><Text style={{display:"block",marginTop:7,fontSize:12}}>{product.name}</Text></div></Col>})}</Row>
      {!products.length&&<Empty description="لا توجد بطاقات معروضة حاليًا"/>}
      {chosen&&<Card id="mini-store-products" title={<Space><Text strong>{chosen.name}</Text><Button size="small" onClick={()=>setSelectedProduct(null)}>إغلاق</Button></Space>} style={{marginTop:20}}>
      <Row gutter={[12,12]}>{catalog.variants.filter(v=>v.product_id===chosen.id && !v.is_frozen).sort((a,b)=>(a.sort_index??0)-(b.sort_index??0)||(a.denomination??999999)-(b.denomination??999999)||a.id-b.id).map(v=><Col xs={12} sm={8} key={v.id}><Card size="small" style={{textAlign:"center"}}><Text strong>{v.name||String(v.denomination||"بطاقة")}</Text><div><Tag color={v.stock_quantity>0?"green":"default"}>{v.stock_quantity>0?"متوفر":"غير متوفر"}</Tag></div></Card></Col>)}</Row>
      <Alert style={{marginTop:14}} type="info" showIcon message="شراء البطاقات غير مفعّل"/>
    </Card>}
    </>}
  </div>;
}
function TableCustomerLogin(){
  const [token,setToken]=useState(()=>window.localStorage.getItem("flexy_mini_customer_token")||"");
  const [account,setAccount]=useState<{username:string;phone?:string;party_id:number;wallet?:{balance:number;debt:number;profit:number}|null}|null>(null);
  const [error,setError]=useState("");
  const [verified,setVerified]=useState(false);
  const call=async(body:Record<string,unknown>)=>{
    const response=await fetch(url+"/functions/v1/flexy-mini-customers",{method:"POST",headers:{"Content-Type":"application/json",apikey:key},body:JSON.stringify({...body,device_secret:window.localStorage.getItem("flexy_mini_device_secret")||""})});
    return {ok:response.ok,status:response.status,data:await response.json()};
  };
  useEffect(()=>{if(!token)return;let active=true;
    const check=()=>void call({action:"me",token}).then(r=>{if(!active)return;if(r.ok){setAccount(r.data);setVerified(true);setError("");}else if([401,403,423].includes(r.status)){window.localStorage.removeItem("flexy_mini_customer_token");setToken("");setAccount(null);setVerified(false);setError(r.data.error||"انتهت الجلسة");}else{setAccount(null);setVerified(false);setError("تعذر التحقق مؤقتًا. سنعيد المحاولة دون تسجيل خروجك.");}}).catch(()=>{if(active){setAccount(null);setVerified(false);setError("تعذر الاتصال للتحقق من الجلسة. سنعيد المحاولة تلقائيًا.");}});
    check();const timer=window.setInterval(check,15000);window.addEventListener("focus",check);
    return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",check);};
  },[token]);
  const logout=async()=>{try{await call({action:"logout",token});}catch{}window.localStorage.removeItem("flexy_mini_customer_token");setToken("");setAccount(null);window.location.hash="#/login";};
  if(!token)return <Navigate to="/login" replace/>;
  return <Dashboard customerToken={token} customerAccount={verified?account:null} customerError={error} onCustomerLogout={()=>void logout()}/>;
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
    <Alert type="info" showIcon message="الشحن غير مفعّل" style={{marginBottom:16}}/>
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
const movementFields = [
 {key:"date",label:"التاريخ"},{key:"type",label:"النوع"},{key:"amount",label:"المبلغ"},
 {key:"balance",label:"الرصيد قبل/بعد"},{key:"debt",label:"الديون قبل/بعد"},
 {key:"profit",label:"الأرباح قبل/بعد"},{key:"note",label:"ملاحظة"},{key:"agent",label:"المندوب"}
] as const;
type MovementField = typeof movementFields[number]["key"];
type MovementType = "all"|"profit"|"topup"|"debt"|"payment"|"cash"|"refund_debt"|"refund_payment"|"refund_cash"|"transfer";
const movementDefaults:Record<MovementType,MovementField[]> = {
 all:["date","type","amount","balance"],profit:["date","type","amount","profit","balance"],
 topup:["date","type","amount","balance"],debt:["date","type","amount","debt"],
 payment:["date","type","amount","debt","balance"],cash:["date","type","amount","balance"],
 refund_debt:["date","type","amount","debt"],refund_payment:["date","type","amount","debt","balance"],
 refund_cash:["date","type","amount","balance"],transfer:["date","type","amount","balance"]
};
function MovementLedger({admin}:{admin:boolean}) {
 const [kind,setKind]=useState<MovementType>("all");
 const [custom,setCustom]=useState<Partial<Record<MovementType,MovementField[]>>>(()=>{try{return JSON.parse(localStorage.getItem("flexy_mini_movement_columns_v1")||"{}")}catch{return {}}});
 const [showSettings,setShowSettings]=useState(false);
 const fields=custom[kind]||movementDefaults[kind];
 const setFields=(next:MovementField[])=>{const updated={...custom,[kind]:next};setCustom(updated);try{localStorage.setItem("flexy_mini_movement_columns_v1",JSON.stringify(updated))}catch{}};
 const [range,setRange]=useState<[string,string]>(["",""]);
 const [search,setSearch]=useState("");
 return <Card title={admin?"سجل التحويلات":"تحويلاتي"}>
  <Alert type="info" showIcon message="التحويلات غير مفعّلة" style={{marginBottom:16}}/>
  <Space wrap style={{marginBottom:14}}>
   <Select value={kind} style={{width:165}} onChange={v=>setKind(v)} options={[
    {value:"all",label:"الكل"},{value:"debt",label:"دين"},{value:"payment",label:"دفع"},
    {value:"cash",label:"نقد"},{value:"refund_debt",label:"استرداد دين"},
    {value:"refund_payment",label:"استرداد دفع"},{value:"refund_cash",label:"استرداد نقد"},
    {value:"topup",label:"شحن ذاتي"},{value:"profit",label:"أرباح"},
    {value:"transfer",label:"تحويل رصيد"}
   ]}/>
   <Button onClick={()=>setShowSettings(v=>!v)} icon={<SettingOutlined/>}>إظهار وإخفاء الأعمدة</Button>
   {admin&&<Tag color="blue">إعدادات عرض الإدارة</Tag>}
  </Space>
  {showSettings&&<Card size="small" title="الأعمدة المعروضة" style={{marginBottom:16}}>
   <Space wrap>{movementFields.map(f=><Checkbox key={f.key} checked={fields.includes(f.key)} disabled={f.key==="date"||f.key==="type"||f.key==="amount"} onChange={e=>setFields(e.target.checked?[...fields,f.key]:fields.filter(k=>k!==f.key))}>{f.label}</Checkbox>)}</Space>
   <div style={{marginTop:12}}><Button size="small" onClick={()=>setFields(movementDefaults[kind])}>استرجاع العرض الافتراضي</Button></div>
  </Card>}
  <Space wrap style={{marginBottom:14}}>
   <Input type="date" aria-label="من تاريخ" value={range[0]} onChange={e=>setRange([e.target.value,range[1]])}/>
   <Input type="date" aria-label="حتى تاريخ" value={range[1]} onChange={e=>setRange([range[0],e.target.value])}/>
   <Input.Search placeholder="بحث في التحويلات" value={search} onChange={e=>setSearch(e.target.value)} style={{width:220}}/>
  </Space>
  <div style={{overflowX:"auto"}}><Table size="small" rowKey="id" dataSource={[]} pagination={{pageSize:10,showSizeChanger:true,pageSizeOptions:["10","20","50"]}} locale={{emptyText:"لا توجد تحويلات مسجلة في هذه الواجهة"}} columns={movementFields.filter(f=>fields.includes(f.key)).map(f=>({title:f.label,dataIndex:f.key,key:f.key}))}/></div>
 </Card>;
}
function DeferredPanel({children}:{children:React.ReactNode}) {
 return <Suspense fallback={<Card loading style={{minHeight:100}}/>}>{children}</Suspense>;
}
function Dashboard({customerToken,customerAccount,customerError,onCustomerLogout}:{customerToken?:string;customerAccount?:{username:string;phone?:string;party_id:number;wallet?:{balance:number;debt:number;profit:number}|null}|null;customerError?:string;onCustomerLogout?:()=>void} = {}) {
  const isCustomer=Boolean(customerToken);
  const { mutate: logout } = useLogout();
  const validPages = new Set(["home","flexy","idoom","store","operations","cards","inventory","customers","devices","wallets","stations","supplier-sites","members","ads","settings"]);
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
  const customerItems = items.filter(group=>group.label==="الخدمات");
  const menu = <Menu aria-label="أقسام التطبيق" mode="inline" selectedKeys={[page]} items={isCustomer?customerItems:items} onClick={({ key }) => { setPage(key); setDrawer(false); }} />;
  return <ConfigProvider direction="rtl" theme={{ token: { colorPrimary: "#2563eb", borderRadius: 10 } }}>
    <Layout className="app-layout" dir="rtl">
      {!isCustomer && <BuildCopyButton />}
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
          <Space><Tag color={client ? "green" : "blue"}>v0.9.2 · {isCustomer ? "حساب الزبون" : client ? "دخول الإدارة" : "إعداد الاتصال مطلوب"}</Tag>{<Button size="small" onClick={isCustomer?onCustomerLogout:()=>logout()}>خروج</Button>}</Space>
        </Header>
        <Content className="app-content">
          {page !== "home" && <div className="page-heading"><Title level={mobile ? 3 : 2}>{names[page]}</Title></div>}
          {isCustomer && !customerAccount && <Alert type={customerError?"warning":"info"} showIcon message={customerError||"جاري التحقق من حساب الزبون"} style={{marginBottom:16}}/>}
          {isCustomer && customerAccount && page==="home" && <Alert type="success" showIcon message={"مرحبًا "+customerAccount.username} style={{marginBottom:16}}/>}
          {page === "home" ? <>
            {client && <div style={{marginBottom:18}}><DeferredPanel><AdSystem db={client} customer={isCustomer}/></DeferredPanel></div>}
            {!isCustomer && client && <DeferredPanel><AdminWallet db={client}/></DeferredPanel>}
            <Card style={{marginBottom:18}} title="ملخص حسابي"><Row gutter={[12,12]}>{(["الرصيد","الديون","الأرباح"] as const).map((label,i)=><Col xs={8} key={label}><div style={{textAlign:"center"}}><Text type="secondary">{label}</Text><div><Text strong>{isCustomer&&customerAccount?.wallet ? Number(customerAccount.wallet[([ "balance","debt","profit" ] as const)[i]]).toLocaleString("ar-DZ")+" دج" : "غير متاح حاليًا"}</Text></div></div></Col>)}</Row></Card>

            <Title level={4} style={{ marginBottom: 16 }}>الخدمات</Title>
            <Row gutter={[12, 12]}>
              {[
                { title: "الفليكسي", subtitle: "عمليات الشحن", color: "#f0523b", target: "flexy", symbol: "PhoneOutlined" },
                { title: "تعبئة إيدوم", subtitle: "خدمات الإنترنت", color: "#41b95a", target: "idoom", symbol: "WifiOutlined" },
                { title: "بطاقات رقمية", subtitle: "ألعاب، اتصالات وبرامج", color: "#625ee8", target: "store", symbol: "AppstoreOutlined" }
              ].map(service => <Col xs={24} md={8} key={service.title}><Card hoverable onClick={() => setPage(service.target)} style={{background:service.color,borderColor:service.color}}><Space direction="vertical" size="middle"><Space align="center"><span style={{color:"#fff"}}>{service.symbol==="PhoneOutlined"?<PhoneOutlined/>:service.symbol==="WifiOutlined"?<WifiOutlined/>:<AppstoreOutlined/>}</span><Typography.Text strong style={{color:"#fff"}}>{service.title}</Typography.Text></Space><Typography.Text style={{color:"#fff"}}>{service.subtitle}</Typography.Text></Space></Card></Col>)}
            </Row>
          </> : page === "flexy" ? <DeferredPanel><FlexyServicePage db={client} isCustomer={isCustomer} onOpenStations={isCustomer ? undefined : () => setPage("stations")}/></DeferredPanel> : isCustomer ? (page==="store"||page==="cards" ? <SharedCardsStore token={customerToken!}/> : page==="operations" ? <MovementLedger admin={false}/> : <Card title={names[page]}><Empty description="الخدمة قيد التجهيز"/></Card>) : page === "store" ? <SharedCardsStore/> : page === "ads" && client ? <DeferredPanel><AdSystem db={client} admin /></DeferredPanel> : page === "supplier-sites" && client ? <DeferredPanel><SupplierSites db={client}/></DeferredPanel> : page === "stations" && client ? <DeferredPanel><StationOverview db={client}/></DeferredPanel> : page === "settings" ? <ConnectionDiagnostics /> : page === "devices" ? <TrustedDevices /> : page === "wallets" ? <MiniWalletAdmin /> : page === "customers" ? <MasterCustomerLookup /> : page === "members" ? <><MiniMembers />{client&&<DeferredPanel><CreditAdmin db={client}/></DeferredPanel>}</> : page === "cards" ? <Space direction="vertical" size="large" style={{width:"100%"}}><SharedCardsStore/><CardsCatalog /></Space> : page === "inventory" && client ? <DeferredPanel><CardCodeImportAdmin db={client}/></DeferredPanel> : page === "operations" ? <MovementLedger admin={!isCustomer}/> : <Card title={names[page]}><Empty description="الخدمة قيد التجهيز" /></Card>}
          <div className="app-footer">Flexy Mini · Refine + Ant Design · عرض تجريبي فقط</div>
        </Content>
        <nav className="bottom-service-nav" aria-label="خدمات الموقع" dir="rtl">
          {!isCustomer && <a className="flexy-lab-shortcut" href="/flexy-mini/lab.html"
            target="_blank" rel="noopener noreferrer" aria-label="فتح مختبر محاكاة فليكسي">
            🧪 المحاكاة
          </a>}
          {[
            {key:"flexy",label:"فليكسي",symbol:"PhoneOutlined"},
            {key:"idoom",label:"تعبئة إيدوم",symbol:"WifiOutlined"},
            {key:"home",label:"الرئيسية",symbol:"HomeOutlined"},
            {key:"store",label:"البطاقات",symbol:"AppstoreOutlined"},
            {key:"operations",label:"العمليات",symbol:"HistoryOutlined"}
          ].map(item=><Button key={item.key} type="text" className={page===item.key?"service-nav-active":""} onClick={()=>setPage(item.key)}><span className="service-nav-icon" aria-hidden="true">{item.symbol==="PhoneOutlined"?<PhoneOutlined/>:item.symbol==="WifiOutlined"?<WifiOutlined/>:item.symbol==="HomeOutlined"?<HomeOutlined/>:item.symbol==="AppstoreOutlined"?<AppstoreOutlined/>:<HistoryOutlined/>}</span><span>{item.label}</span></Button>)}
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
          <Route path="/login" element={client ? <Authenticated key="login-redirect" fallback={<LoginPage />}><Navigate to="/" replace /></Authenticated> : <Alert type="error" showIcon message="التطبيق غير مهيأ للاتصال. لا يمكن الدخول قبل إعداد Supabase." />} />
          <Route path="/" element={client ? (window.localStorage.getItem("flexy_mini_customer_token") ? <Navigate to="/customer-login" replace /> : <Authenticated key="protected" fallback={<LoginPage />}><HomeByRole /></Authenticated>) : <Alert type="error" showIcon message="الاتصال غير مهيأ. تم تعطيل وضع المعاينة المفتوح." />} />
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
