import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Col, Empty, Input, InputNumber, Modal, Row, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import { ArrowRightOutlined, ExperimentOutlined, ReloadOutlined } from "@ant-design/icons";
import type { SupabaseClient } from "@supabase/supabase-js";

type Customer = { id: number; username: string; active: boolean; party_id?: number };
type CustomerList = { data: { customers?: Customer[] } | null; error: Error | null };
type RateService = { key: string; label: string; category: "credit" | "offer" | "other" };
type Rates = Record<string, number>;

const coreServices: RateService[] = [
  { key: "mobilis-credit", label: "موبيليس — عادي", category: "credit" },
  { key: "mobilis-offer", label: "موبيليس — مفعّل", category: "offer" },
  { key: "djezzy-credit", label: "جيزي — عادي", category: "credit" },
  { key: "ooredoo-credit", label: "أوريدو — عادي", category: "credit" }
];
const initialExamples: Rates = {
  "mobilis-credit": 3, "mobilis-offer": 5, "djezzy-credit": 1, "ooredoo-credit": 2
};
const validRate = (value: number | null): value is number => value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
type NetworkFilter = "all" | "mobilis" | "djezzy" | "ooredoo" | "products";
const serviceNetwork = (service: RateService): NetworkFilter =>
  service.key.startsWith("mobilis-") ? "mobilis" :
  service.key.startsWith("djezzy-") ? "djezzy" :
  service.key.startsWith("ooredoo-") ? "ooredoo" : "products";
const networkOptions: { value: NetworkFilter; label: string }[] = [
  { value: "all", label: "كل الشبكات والمنتجات" },
  { value: "mobilis", label: "موبيليس" },
  { value: "djezzy", label: "جيزي" },
  { value: "ooredoo", label: "أوريدو" },
  { value: "products", label: "البطاقات والألعاب والإنترنت" }
];
const percent = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 }) + "%";
const dinars = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " دج";

export default function FlexySimulationPage({
  db, loadCustomers, onBack
}: {
  db?: SupabaseClient;
  loadCustomers: () => Promise<CustomerList>;
  onBack: () => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<RateService[]>(coreServices);
  const [defaults, setDefaults] = useState<Rates>(initialExamples);
  const [accountRates, setAccountRates] = useState<Record<number, Rates>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [accountStatus, setAccountStatus] = useState("all");
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("mobilis-credit");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tab, setTab] = useState("customers");
  const [testId, setTestId] = useState<number | null>(null);
  const [testService, setTestService] = useState("mobilis-credit");
  const [amount, setAmount] = useState(1000);
  const [purchaseDiscount, setPurchaseDiscount] = useState(4);
  const [fee, setFee] = useState(0);
  const [sourceReady, setSourceReady] = useState(true);

  // This is a RAM-only simulation. No customer, wallet, financial, or pricing mutation RPC exists here.
  useEffect(() => {
    let live = true;
    const boot = async () => {
      try {
        const [list, productResult] = await Promise.all([
          loadCustomers(),
          db ? db.from("flexy_mini_products").select("id,name").order("id", { ascending: true }).limit(100) : Promise.resolve(null)
        ]);
        if (!live) return;
        if (list.error) throw list.error;
        if (!Array.isArray(list.data?.customers)) throw new Error("لم ترجع خدمة الإدارة قائمة الزبائن");
        const records = list.data.customers
          .filter(c => typeof c.id === "number" && typeof c.username === "string")
          .map(c => ({ id: c.id, username: c.username, active: Boolean(c.active), party_id: c.party_id }));
        const cards: RateService[] = !productResult?.error && Array.isArray(productResult?.data)
          ? productResult.data.map((p: { id: number; name: string }) => ({
            key: "card:" + p.id, label: "منتج — " + p.name, category: "other" as const
          }))
          : [];
        const definitions = [...coreServices, ...cards];
        const startRates = { ...initialExamples, ...Object.fromEntries(cards.map(c => [c.key, 0])) };
        // Existing accounts in this preview get a local snapshot once, just like the approved signup model.
        setServices(definitions);
        setDefaults(startRates);
        setAccountRates(Object.fromEntries(records.map(c => [c.id, { ...startRates }])));
        setCustomers(records);
        setTestId(records[0]?.id ?? null);
        setLoadError(productResult?.error ? "تعذر قراءة أصناف البطاقات؛ المحاكاة تعرض خدمات الاتصالات فقط." : "");
      } catch (error) {
        if (live) setLoadError(error instanceof Error ? error.message : "تعذر تحميل الزبائن");
      } finally {
        if (live) setLoading(false);
      }
    };
    void boot();
    return () => { live = false; };
    // Deliberately only on mounting the sandbox; reloading is an explicit fresh simulation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() =>
    customers.filter(c =>
      (c.username + " " + (c.party_id ?? "")).toLowerCase().includes(query.trim().toLowerCase()) &&
      (accountStatus === "all" || (accountStatus === "active" ? c.active : !c.active))),
  [customers, query, accountStatus]);
  const networkServices = useMemo(
    () => services.filter(service => networkFilter === "all" || serviceNetwork(service) === networkFilter),
    [services, networkFilter]
  );
  const filteredServices = useMemo(
    () => networkServices.filter(service => serviceFilter === "all" || service.key === serviceFilter),
    [networkServices, serviceFilter]
  );
  // Limit only the customer comparison table width. Default and edit tables show every matching service.
  const visibleCustomerServices = serviceFilter === "all" ? filteredServices.slice(0, 3) : filteredServices;
  const serviceOptions = [
    { value: "all", label: "كل خدمات هذا الفلتر" },
    ...networkServices.map(service => ({ value: service.key, label: service.label }))
  ];
  const editing = customers.find(c => c.id === editingId);
  const testing = customers.find(c => c.id === testId);
  const selectedRates = testId === null ? null : accountRates[testId];
  const testRate = selectedRates?.[testService] ?? 0;
  const revenue = amount * (1 - testRate / 100);
  const purchaseCost = amount * (1 - purchaseDiscount / 100) + fee;
  const margin = revenue - purchaseCost;
  const sourceLabel = testService === "mobilis-offer" ? "سما (عرض — مثال)" :
    testService === "mobilis-credit" ? "أرسللي (رصيد عادي — مثال)" : "مورد افتراضي — مثال";

  const changeRate = (customerId: number, key: string, value: number | null) => {
    if (!validRate(value)) return;
    setAccountRates(previous => ({
      ...previous, [customerId]: { ...previous[customerId], [key]: value }
    }));
  };
  const showTest = (id: number) => { setTestId(id); setTab("test"); };
  const updateTestService = (key: string) => {
    setTestService(key);
    setPurchaseDiscount(key === "mobilis-offer" ? 9 : 4);
    setFee(key === "mobilis-offer" ? 10 : 0);
  };
  const percentInput = (value: number, onChange: (next: number | null) => void) =>
    <InputNumber<number> size="small" min={0} max={100} step={0.5} precision={2} value={value}
      onChange={onChange} addonAfter="%" style={{ width: 130 }} aria-label="نسبة الخصم التجريبية" />;

  return <Space direction="vertical" size="middle" style={{ width: "100%" }}>
    <Space wrap>
      <Button icon={<ArrowRightOutlined />} onClick={onBack}>العودة للموقع الرئيسي</Button>
      <Tag color="purple" icon={<ExperimentOutlined />}>محاكاة محلية فقط</Tag>
    </Space>
    <Alert showIcon type="warning" message="تجربة دون أي شحن أو تعديل للزبائن"
      description="الأسماء من حسابات Flexy Mini الموجودة بصلاحية الإدارة. النسب المعروضة أمثلة داخل ذاكرة الصفحة، وليست نسبهم الحقيقية. لا نحفظ شيئًا في Supabase أو في أرصدة الزبائن، وتُصفّر التعديلات التجريبية عند إعادة فتح الصفحة."/>
    {loadError && <Alert showIcon type={customers.length ? "warning" : "error"} message={loadError}/>}
    <Card size="small" title="فلترة النسب حسب الشبكة والخدمة">
      <Row gutter={[8, 8]}>
        <Col xs={24} sm={12}>
          <Typography.Text type="secondary">الشبكة / فئة المنتجات</Typography.Text>
          <Select aria-label="فلتر الشبكة أو فئة المنتج" style={{ width: "100%", marginTop: 5 }}
            value={networkFilter} onChange={value => { setNetworkFilter(value); setServiceFilter("all"); }}
            options={networkOptions}/>
        </Col>
        <Col xs={24} sm={12}>
          <Typography.Text type="secondary">الخدمة / المنتج</Typography.Text>
          <Select aria-label="فلتر الخدمة أو المنتج" style={{ width: "100%", marginTop: 5 }}
            value={serviceFilter} onChange={setServiceFilter} showSearch optionFilterProp="label"
            options={serviceOptions}/>
        </Col>
      </Row>
      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
        {filteredServices.length} خدمة مطابقة — هذا الفلتر يظهر في الافتراضي ونسب الزبائن معًا.
      </Typography.Text>
    </Card>
    <Tabs activeKey={tab} onChange={setTab} items={[
      { key: "customers", label: "نسب الزبائن", children: <Card size="small" title="الزبائن الموجودون" extra={<Tag>{customers.length} حساب</Tag>}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Row gutter={[8, 8]}>
            <Col xs={24} sm={14}>
              <Input.Search allowClear placeholder="ابحث باسم الزبون أو معرّف الماستر" value={query}
                onChange={e => setQuery(e.target.value)}/>
            </Col>
            <Col xs={24} sm={10}>
              <Select aria-label="فلتر حالة الزبون" value={accountStatus} style={{ width: "100%" }}
                onChange={setAccountStatus} options={[
                  { value: "all", label: "كل الزبائن" },
                  { value: "active", label: "النشطون فقط" },
                  { value: "inactive", label: "المعطّلون فقط" }
                ]}/>
            </Col>
          </Row>
          <Typography.Text type="secondary">{filtered.length} زبون مطابق</Typography.Text>
          {serviceFilter === "all" && filteredServices.length > visibleCustomerServices.length &&
            <Alert type="info" showIcon message="يعرض الجدول أول 3 خدمات. اختر خدمة محددة من الفلتر لعرض نسبتها لكل الزبائن."/>}
          <Table<Customer> size="small" rowKey="id" loading={loading} dataSource={filtered} pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: Math.max(440, 350 + visibleCustomerServices.length * 125) }}
            columns={[
              { title: "اسم المستخدم", dataIndex: "username", key: "username", width: 135 },
              ...visibleCustomerServices.map(service => ({
                title: service.label, key: service.key, width: 135,
                render: (_: unknown, c: Customer) => <Tag color="blue">{percent(accountRates[c.id]?.[service.key] ?? 0)}</Tag>
              })),
              { title: "الحالة", key: "status", width: 85, render: (_, c) => <Tag color={c.active ? "green" : "default"}>{c.active ? "نشط" : "معطّل"}</Tag> },
              { title: "النسب التجريبية", key: "rates", width: 170,
                render: (_, c) => <Space size={4} wrap>
                  <Button size="small" onClick={() => setEditingId(c.id)}>تعديل</Button>
                  <Button size="small" onClick={() => showTest(c.id)}>جرّب</Button>
                </Space> }
            ]}
            locale={{ emptyText: <Empty description="لا توجد حسابات مسجلة مطابقة. لم ننشئ زبائن وهميين." /> }}/>
        </Space>
      </Card> },
      { key: "defaults", label: "الافتراضي", children: <Card size="small" title="قالب الحساب الجديد — للتجربة فقط">
        <Alert showIcon type="info" message="تعديل الافتراضي لا يغير نسب أي زبون موجود في المحاكاة؛ يُنسخ فقط عند إنشاء الحساب الحقيقي مستقبلًا، بعد برمجة الميزة." style={{ marginBottom: 12 }}/>
        <Table<RateService> size="small" rowKey="key" dataSource={filteredServices} pagination={{ pageSize: 10 }} columns={[
          { title: "المنتج / الخدمة", dataIndex: "label", key: "label" },
          { title: "النسبة", key: "rate", width: 145, render: (_, s) => percentInput(defaults[s.key] ?? 0,
            value => { if (validRate(value)) setDefaults(old => ({ ...old, [s.key]: value })); }) }
        ]}/>
      </Card> },
      { key: "test", label: "تجربة ربح العملية", children: <Card size="small" title="حاسبة عملية وهمية">
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}><Typography.Text>الزبون الموجود</Typography.Text>
            <Select style={{ width: "100%", marginTop: 5 }} value={testId} onChange={setTestId}
              options={customers.map(c => ({ value: c.id, label: c.username }))} placeholder="اختر زبونًا" /></Col>
          <Col xs={24} md={12}><Typography.Text>الخدمة</Typography.Text>
            <Select style={{ width: "100%", marginTop: 5 }} value={testService} onChange={updateTestService}
              options={services.map(s => ({ value: s.key, label: s.label }))}/></Col>
          <Col xs={24} sm={12}><Typography.Text>قيمة العملية (دج)</Typography.Text>
            <InputNumber min={1} max={1000000} value={amount} onChange={v => v !== null && setAmount(v)}
              style={{ width: "100%", marginTop: 5 }}/></Col>
          <Col xs={24} sm={12}><Typography.Text>خصم الزبون</Typography.Text>
            <div style={{ marginTop: 7 }}><Typography.Text strong>{percent(testRate)}</Typography.Text>
              <Typography.Text type="secondary"> — من إعداد هذا الزبون التجريبي</Typography.Text></div></Col>
          <Col xs={24} sm={12}><Typography.Text>خصم شراء المصدر (افتراضي)</Typography.Text>
            <div style={{ marginTop: 5 }}>{percentInput(purchaseDiscount, v => { if (validRate(v)) setPurchaseDiscount(v); })}</div></Col>
          <Col xs={24} sm={12}><Typography.Text>رسوم المصدر (دج)</Typography.Text>
            <InputNumber min={0} max={100000} value={fee} onChange={v => v !== null && setFee(v)}
              style={{ width: "100%", marginTop: 5 }}/></Col>
        </Row>
        <div style={{ margin: "16px 0" }}>
          <Checkbox checked={sourceReady} onChange={e => setSourceReady(e.target.checked)}>المصدر جاهز ورصيده كافٍ (افتراض)</Checkbox>
        </div>
        <Typography.Text type="secondary">{sourceLabel} — ليست قراءة رصيد ولا إثبات مسار حقيقي</Typography.Text>
        <Card style={{ marginTop: 12 }} size="small">
          {testing ? <Space direction="vertical" style={{ width: "100%" }}>
            <Typography.Text>الزبون: <strong>{testing.username}</strong></Typography.Text>
            <Typography.Text>ما يدفعه الزبون: <strong>{dinars(revenue)}</strong></Typography.Text>
            <Typography.Text>تكلفة التنفيذ المحسوبة: <strong>{dinars(purchaseCost)}</strong></Typography.Text>
            {sourceReady ? <Typography.Text strong style={{ color: margin < 0 ? "#cf1322" : "#237804" }}>
              {margin < 0 ? "خسارة" : "ربح"} العملية: {dinars(Math.abs(margin))}
            </Typography.Text> : <Alert type="warning" showIcon message="المصدر غير جاهز، لا يمكن اختياره حتى لو كان الربح أعلى"/>}
          </Space> : <Empty description="اختر زبونًا موجودًا حتى تظهر الحسابات"/>}
        </Card>
        <Alert style={{ marginTop: 12 }} type="info" showIcon
          message="الحاسبة تعليمية فقط: لا تحدد مصدر تنفيذ فعليًا، ولا تقارن مسارات الشبكة، ولا ترسل USSD."/>
      </Card> }
    ]}/>
    <Modal title={editing ? "نسب " + editing.username + " — محاكاة فقط" : "نسب الزبون"}
      open={editingId !== null} onCancel={() => setEditingId(null)} footer={<Button type="primary" onClick={() => setEditingId(null)}>إغلاق المعاينة</Button>} width={630}>
      <Alert type="info" showIcon message="التغييرات تخص المحاكاة الحالية فقط، وليست حفظًا في حساب الزبون." style={{ marginBottom: 12 }}/>
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12}>
          <Typography.Text type="secondary">فلتر الشبكة</Typography.Text>
          <Select aria-label="فلتر الشبكة داخل تعديل النسب" style={{ width: "100%", marginTop: 5 }}
            value={networkFilter} options={networkOptions}
            onChange={value => { setNetworkFilter(value); setServiceFilter("all"); }}/>
        </Col>
        <Col xs={24} sm={12}>
          <Typography.Text type="secondary">فلتر المنتج / الخدمة</Typography.Text>
          <Select aria-label="فلتر الخدمة داخل تعديل النسب" style={{ width: "100%", marginTop: 5 }}
            value={serviceFilter} options={serviceOptions} onChange={setServiceFilter}
            showSearch optionFilterProp="label"/>
        </Col>
      </Row>
      {editing && <>
        <Space wrap style={{ marginBottom: 12 }}>
          <Button onClick={() => setAccountRates(old => ({
            ...old, [editing.id]: { ...old[editing.id], "mobilis-credit": 0, "mobilis-offer": 0 }
          }))}>0% للعادي والمفعّل معًا</Button>
          <Button icon={<ReloadOutlined />} onClick={() => setAccountRates(old => ({ ...old, [editing.id]: { ...defaults } }))}>
            نسخ الافتراضي الحالي لهذا الزبون (تجربة)
          </Button>
        </Space>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 10 }}>
          الفلتر اللي فوق الصفحة يطبق هنا أيضًا: {filteredServices.length} خدمة
        </Typography.Text>
        <Table<RateService> size="small" rowKey="key" dataSource={filteredServices} pagination={{ pageSize: 8 }}
          columns={[
            { title: "الخدمة / المنتج", dataIndex: "label", key: "label" },
            { title: "نسبة الزبون", key: "rate", width: 150, render: (_, s) =>
              percentInput(accountRates[editing.id]?.[s.key] ?? 0, v => changeRate(editing.id, s.key, v)) }
          ]}/>
      </>}
    </Modal>
  </Space>;
}
