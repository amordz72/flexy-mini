import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Authenticated, Refine, useLogin, useLogout } from "@refinedev/core";
import type { AuthProvider } from "@refinedev/core";
import { AuthPage } from "@refinedev/antd";
import { HashRouter, Route, Routes } from "react-router";
import routerProvider from "@refinedev/react-router";
import { createClient } from "@supabase/supabase-js";
import { dataProvider, liveProvider } from "@refinedev/supabase";

import { ConfigProvider, Form, Input, Layout, Menu, Typography, Card, Row, Col, Table, Tag, Button, Space, Alert, Grid, Drawer, Empty, Descriptions } from "antd";
import "antd/dist/reset.css";
import "./style.css";

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
    if (!(await isShopAdmin())) {
      await client.auth.signOut();
      return { success: false, error: { name: "AccessDenied", message: "هذا الحساب غير مخوّل للدخول إلى الإدارة" } };
    }
    return { success: true, redirectTo: "/" };
  },
  logout: async () => {
    const { error } = await client.auth.signOut();
    return error ? { success: false, error: { name: "LogoutError", message: "تعذر تسجيل الخروج" } } : { success: true, redirectTo: "/login" };
  },
  check: async () => {
    const { data, error } = await client.auth.getSession();
    return !error && data.session && await isShopAdmin() ? { authenticated: true } : { authenticated: false, redirectTo: "/login" };
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
  { key: "home", label: "الرئيسية" },
  { key: "flexy", label: "عمليات الفليكسي" },
  { key: "cards", label: "مخزون البطاقات" },
  { key: "customers", label: "الزبائن" },
  { key: "stations", label: "المحطات والشرائح" },
  { key: "settings", label: "الإعدادات" },
  { key: "members", label: "صلاحيات فليكسي ميني" },
];
const names: Record<string, string> = {
  home: "لوحة التحكم", flexy: "عمليات الفليكسي", cards: "مخزون البطاقات",
  customers: "الزبائن", stations: "المحطات والشرائح", settings: "الإعدادات", members: "صلاحيات فليكسي ميني"
};
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
type CatalogProduct = { id: number; category_id: number; name: string; sort_index: number; active: boolean };
type CatalogVariant = { id: number; product_id: number; name: string; denomination: number | null; purchase_price: number; markup_percent: number; sort_index: number; active: boolean };
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
  const visibleProducts = products.filter(p => p.category_id === categoryId && p.active);
  const visibleVariants = variants.filter(v => v.product_id === productId && v.active)
    .sort((a, b) => a.sort_index - b.sort_index || (a.denomination ?? 999999) - (b.denomination ?? 999999) || a.id - b.id);
  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <Alert type="info" showIcon message="إدارة كتالوج البطاقات: قسم ← نوع ← بطاقة. لا توجد مبيعات أو أكواد شحن مفعّلة." />
    {error && <Alert type="error" showIcon message={error} closable onClose={() => setError("")} />}
    <Card title="1 — الأقسام" loading={busy && !categories.length}>
      <Space wrap>{categories.filter(c => c.active).map(c => <Button key={c.id} type={categoryId === c.id ? "primary" : "default"} onClick={() => { setCategoryId(c.id); setProductId(null); }}>{c.name}</Button>)}</Space>
      <Form form={categoryForm} layout="inline" style={{ marginTop: 16, gap: 8 }} onFinish={v => save("flexy_mini_categories", { name: v.name.trim(), sort_index: Number(v.sort_index || 0) }, categoryForm)}>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="اسم القسم" /></Form.Item>
        <Form.Item name="sort_index" initialValue={0}><Input type="number" placeholder="Index" style={{ width: 90 }} /></Form.Item>
        <Button htmlType="submit" type="primary" disabled={busy}>إضافة قسم</Button>
      </Form>
    </Card>
    {categoryId !== null && <Card title="2 — الأنواع">
      <Space wrap>{visibleProducts.map(p => <Button key={p.id} type={productId === p.id ? "primary" : "default"} onClick={() => { setProductId(p.id); window.setTimeout(() => document.getElementById("mini-variants")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>{p.name}</Button>)}</Space>
      <Form form={productForm} layout="inline" style={{ marginTop: 16, gap: 8 }} onFinish={v => save("flexy_mini_products", { category_id: categoryId, name: v.name.trim(), sort_index: Number(v.sort_index || 0) }, productForm)}>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="اسم النوع" /></Form.Item>
        <Form.Item name="sort_index" initialValue={0}><Input type="number" placeholder="Index" style={{ width: 90 }} /></Form.Item>
        <Button htmlType="submit" type="primary" disabled={busy}>إضافة نوع</Button>
      </Form>
    </Card>}
    {productId !== null && <Card id="mini-variants" title="3 — البطاقات">
      <Row gutter={[12, 12]}>{visibleVariants.map(v => <Col xs={24} sm={12} lg={8} key={v.id}><Card size="small" title={v.name}><Text>القيمة: {v.denomination ?? "—"}</Text><div>سعر الشراء: {v.purchase_price} دج</div><div>الربح: {v.markup_percent}%</div><Title level={5}>سعر البيع: {(Number(v.purchase_price) * (1 + Number(v.markup_percent) / 100)).toFixed(2)} دج</Title><Tag>Index {v.sort_index}</Tag></Card></Col>)}</Row>
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
function Dashboard() {
  const { mutate: logout } = useLogout();
  const [page, setPage] = useState("home");
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
          <Space><Tag color={client ? "green" : "blue"}>v0.6.4 · {client ? "دخول الإدارة" : "إعداد الاتصال مطلوب"}</Tag>{client && <Button size="small" onClick={() => logout()}>خروج</Button>}</Space>
        </Header>
        <Content className="app-content">
          <div className="page-heading"><Title level={mobile ? 3 : 2}>{names[page]}</Title><Text type="secondary">نسخة معاينة · بدون معاملات</Text></div>
          <Alert type="info" showIcon message="هذه لوحة إدارة تجريبية. لا توجد عمليات مالية أو شحن مفعّلة." className="notice" />
          {page === "settings" ? <ConnectionDiagnostics /> : page === "home" ? <>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}><Card title="الفليكسي"><Title level={3}>تجريبي</Title><Text type="secondary">ربط التنفيذ في مرحلة لاحقة</Text></Card></Col>
              <Col xs={24} sm={12} lg={8}><Card title="البطاقات"><Title level={3}>غير مربوط</Title><Text type="secondary">المخزون لم يُربط بعد</Text></Card></Col>
              <Col xs={24} sm={12} lg={8}><Card title="Supabase"><Title level={3}>{client ? "إعدادات موجودة" : "غير مهيأ"}</Title><Text type="secondary">{client ? "اختبر الوصول من صفحة الإعدادات" : "لا توجد متغيرات اتصال للنشر"}</Text></Card></Col>
            </Row>
            <Card title="الوحدات المخططة" className="section-card">
              <Table size="small" pagination={false} scroll={{ x: 450 }} dataSource={sample} columns={[
                { title: "الوحدة", dataIndex: "name" },
                { title: "النوع", dataIndex: "kind" },
                { title: "الحالة", dataIndex: "state", render: (v: string) => <Tag>{v}</Tag> }
              ]} />
            </Card>
          </> : page === "members" ? <MiniMembers /> : page === "cards" ? <CardsCatalog /> : <Card title={names[page]}>
            <Empty description="لا توجد بيانات متصلة بعد" /><div className="placeholder-note"><Text>قسم {names[page]} جاهز للتجهيز. لن يتم تنفيذ أي عملية أو تغيير بيانات في هذه النسخة.</Text></div>
          </Card>}
          <div className="app-footer">Flexy Mini · Refine + Ant Design · عرض تجريبي فقط</div>
        </Content>
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
          <Route path="/login" element={client ? <LoginPage /> : <Alert type="error" showIcon message="التطبيق غير مهيأ للاتصال. لا يمكن الدخول قبل إعداد Supabase." />} />
          <Route path="/" element={client ? <Authenticated key="protected" fallback={<LoginPage />}><Dashboard /></Authenticated> : <Alert type="error" showIcon message="الاتصال غير مهيأ. تم تعطيل وضع المعاينة المفتوح." />} />
        </Routes>
      </Refine>
    </HashRouter>
  </React.StrictMode>
);
