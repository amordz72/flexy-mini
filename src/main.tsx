import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Authenticated, Refine, useLogout } from "@refinedev/core";
import type { AuthProvider } from "@refinedev/core";
import { AuthPage } from "@refinedev/antd";
import { HashRouter, Route, Routes } from "react-router";
import routerProvider from "@refinedev/react-router";
import { createClient } from "@supabase/supabase-js";
import { dataProvider, liveProvider } from "@refinedev/supabase";

import { ConfigProvider, Layout, Menu, Typography, Card, Row, Col, Table, Tag, Button, Space, Alert, Grid, Drawer, Empty, Descriptions } from "antd";
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
  login: async ({ email, password }) => {
    const { error } = await client.auth.signInWithPassword({ email, password });
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
const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const items = [
  { key: "home", label: "الرئيسية" },
  { key: "flexy", label: "عمليات الفليكسي" },
  { key: "cards", label: "مخزون البطاقات" },
  { key: "customers", label: "الزبائن" },
  { key: "stations", label: "المحطات والشرائح" },
  { key: "settings", label: "الإعدادات" },
];
const names: Record<string, string> = {
  home: "لوحة التحكم", flexy: "عمليات الفليكسي", cards: "مخزون البطاقات",
  customers: "الزبائن", stations: "المحطات والشرائح", settings: "الإعدادات"
};
const sample = [
  { key: "1", name: "موبيليس", kind: "فليكسي", state: "واجهة تجريبية" },
  { key: "2", name: "بطاقات موبيليس", kind: "بطاقات", state: "غير مربوط" },
  { key: "3", name: "Station Connect", kind: "محطات", state: "غير مربوط" },
];
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
          <Space><Tag color={client ? "green" : "blue"}>v0.6.3 · {client ? "دخول الإدارة" : "إعداد الاتصال مطلوب"}</Tag>{client && <Button size="small" onClick={() => logout()}>خروج</Button>}</Space>
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
          </> : <Card title={names[page]}>
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
          <Route path="/login" element={client ? <AuthPage type="login" registerLink={false} forgotPasswordLink={false} /> : <Alert type="error" showIcon message="التطبيق غير مهيأ للاتصال. لا يمكن الدخول قبل إعداد Supabase." />} />
          <Route path="/" element={client ? <Authenticated key="protected" fallback={<AuthPage type="login" registerLink={false} forgotPasswordLink={false} />}><Dashboard /></Authenticated> : <Alert type="error" showIcon message="الاتصال غير مهيأ. تم تعطيل وضع المعاينة المفتوح." />} />
        </Routes>
      </Refine>
    </HashRouter>
  </React.StrictMode>
);
