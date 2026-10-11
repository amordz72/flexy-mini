import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Refine } from "@refinedev/core";
import { BrowserRouter, Route, Routes } from "react-router";
import routerProvider from "@refinedev/react-router";
import { createClient } from "@supabase/supabase-js";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import { ConfigProvider, Layout, Menu, Typography, Card, Row, Col, Table, Tag, Button, Space, Alert, Grid, Drawer, Empty } from "antd";
import "antd/dist/reset.css";
import "./style.css";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const client = url && key ? createClient(url, key) : undefined;
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
function Dashboard() {
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
          <Tag color="blue">v0.2.1 · تجربة</Tag>
        </Header>
        <Content className="app-content">
          <div className="page-heading"><Title level={mobile ? 3 : 2}>{names[page]}</Title><Text type="secondary">نسخة معاينة · بدون معاملات</Text></div>
          <Alert type="info" showIcon message="هذه لوحة إدارة تجريبية. لا توجد عمليات مالية أو شحن مفعّلة." className="notice" />
          {page === "home" ? <>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}><Card title="الفليكسي"><Title level={3}>تجريبي</Title><Text type="secondary">ربط التنفيذ في مرحلة لاحقة</Text></Card></Col>
              <Col xs={24} sm={12} lg={8}><Card title="البطاقات"><Title level={3}>غير مربوط</Title><Text type="secondary">المخزون لم يُربط بعد</Text></Card></Col>
              <Col xs={24} sm={12} lg={8}><Card title="Supabase"><Title level={3}>{client ? "مهيأ" : "غير مهيأ"}</Title><Text type="secondary">{client ? "الإعدادات موجودة، الاتصال غير مختبر" : "يلزم إعداد الاتصال لاحقًا"}</Text></Card></Col>
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
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Refine routerProvider={routerProvider} dataProvider={client ? dataProvider(client) : undefined}
        liveProvider={client ? liveProvider(client) : undefined}
        resources={[]} options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}>
        <Routes><Route path="/" element={<Dashboard />} /></Routes>
      </Refine>
    </BrowserRouter>
  </React.StrictMode>
);
