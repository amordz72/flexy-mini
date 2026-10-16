import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Col, Empty, Input, InputNumber, Modal, Row, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import { ArrowRightOutlined, ExperimentOutlined } from "@ant-design/icons";
import type { SupabaseClient } from "@supabase/supabase-js";

type Customer = { id: number; username: string; active: boolean; party_id?: number };
type CustomerList = { data: { customers?: Customer[] } | null; error: Error | null };
type RateService = { key: string; label: string; category: "credit" | "offer" | "other" };
type Rates = Record<string, number>;
type RateCategory = "flexy" | "idoom" | "cards" | "games";

const coreServices: RateService[] = [
  { key: "mobilis-credit", label: "موبيليس — عادي", category: "credit" },
  { key: "mobilis-offer", label: "موبيليس — مفعّل", category: "offer" },
  { key: "djezzy-credit", label: "جيزي — عادي", category: "credit" },
  { key: "ooredoo-credit", label: "أوريدو — عادي", category: "credit" }
];
const initialExamples: Rates = {
  "mobilis-credit": 3, "mobilis-offer": 5, "djezzy-credit": 1, "ooredoo-credit": 2
};
const categoryNames: Record<RateCategory, string> = {
  flexy: "الفليكسي", idoom: "إيدوم والإنترنت", cards: "بطاقات الاتصالات", games: "الألعاب والبطاقات الرقمية"
};
const categories: RateCategory[] = ["flexy", "idoom", "cards", "games"];
const serviceCategory = (service: RateService): RateCategory => {
  if (!service.key.startsWith("card:")) return "flexy";
  const name = service.label.toLowerCase();
  if (/idoom|adsl|4g|lte|internet|انترنت|إنترنت|ايدوم|إيدوم/.test(name)) return "idoom";
  if (/free.?fire|pubg|steam|playstation|itunes|game|top.?up|فري فاير|ببجي|ستيم|بلاي/.test(name)) return "games";
  return "cards";
};
const validRate = (value: number | null): value is number => value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
const percent = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 }) + "%";
const dinars = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " دج";

export default function FlexySimulationPage({ db, loadCustomers, onBack }: {
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
  const [category, setCategory] = useState<RateCategory>("flexy");
  const [serviceKey, setServiceKey] = useState("mobilis-credit");
  const [query, setQuery] = useState("");
  const [accountStatus, setAccountStatus] = useState("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftRate, setDraftRate] = useState<number | null>(0);
  const [applyBoth, setApplyBoth] = useState(false);
  const [tab, setTab] = useState("customers");
  const [testId, setTestId] = useState<number | null>(null);
  const [testService, setTestService] = useState("mobilis-credit");
  const [amount, setAmount] = useState(1000);
  const [purchaseDiscount, setPurchaseDiscount] = useState(4);
  const [fee, setFee] = useState(0);
  const [sourceReady, setSourceReady] = useState(true);

  // Admin-only read of existing accounts and products. All prices/rates live only in React memory.
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
          .filter(customer => typeof customer.id === "number" && typeof customer.username === "string")
          .map(customer => ({
            id: customer.id, username: customer.username, active: Boolean(customer.active), party_id: customer.party_id
          }));
        const cardServices: RateService[] = !productResult?.error && Array.isArray(productResult?.data)
          ? productResult.data.map((product: { id: number; name: string }) => ({
            key: "card:" + product.id, label: product.name, category: "other" as const
          }))
          : [];
        const allServices = [...coreServices, ...cardServices];
        const snapshot = { ...initialExamples, ...Object.fromEntries(cardServices.map(service => [service.key, 0])) };
        setServices(allServices);
        setDefaults(snapshot);
        setAccountRates(Object.fromEntries(records.map(customer => [customer.id, { ...snapshot }])));
        setCustomers(records);
        setTestId(records[0]?.id ?? null);
        setLoadError(productResult?.error ? "تعذر قراءة أسماء المنتجات؛ خدمات الفليكسي ما زالت متاحة للمحاكاة." : "");
      } catch (error) {
        if (live) setLoadError(error instanceof Error ? error.message : "تعذر تحميل الزبائن");
      } finally {
        if (live) setLoading(false);
      }
    };
    void boot();
    return () => { live = false; };
    // One safe read per simulator mount; never auto-create or update accounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCustomers = useMemo(() => customers.filter(customer =>
    (customer.username + " " + (customer.party_id ?? "")).toLowerCase().includes(query.trim().toLowerCase()) &&
    (accountStatus === "all" || (accountStatus === "active" ? customer.active : !customer.active)),
  ), [customers, query, accountStatus]);
  const servicesInCategory = useMemo(() => services.filter(service => serviceCategory(service) === category), [services, category]);
  const currentService = servicesInCategory.find(service => service.key === serviceKey);
  const editing = customers.find(customer => customer.id === editingId);
  const testing = customers.find(customer => customer.id === testId);
  const testedRate = testId === null ? 0 : (accountRates[testId]?.[testService] ?? 0);
  const revenue = amount * (1 - testedRate / 100);
  const purchaseCost = amount * (1 - purchaseDiscount / 100) + fee;
  const margin = revenue - purchaseCost;

  const changeCategory = (value: RateCategory) => {
    setCategory(value);
    const first = services.find(service => serviceCategory(service) === value);
    const next = first?.key ?? "";
    setServiceKey(next);
    if (editingId !== null) setDraftRate(accountRates[editingId]?.[next] ?? 0);
    setApplyBoth(false);
  };
  const changeService = (value: string) => {
    setServiceKey(value);
    if (editingId !== null) setDraftRate(accountRates[editingId]?.[value] ?? 0);
    setApplyBoth(false);
  };
  const openEditor = (customer: Customer) => {
    setEditingId(customer.id);
    setDraftRate(accountRates[customer.id]?.[serviceKey] ?? 0);
    setApplyBoth(false);
  };
  const closeEditor = () => { setEditingId(null); setApplyBoth(false); };
  const applyEditedRate = () => {
    if (editingId === null || !currentService || !validRate(draftRate)) return;
    const id = editingId;
    const rate = draftRate;
    setAccountRates(previous => ({
      ...previous,
      [id]: applyBoth && category === "flexy" && serviceKey.startsWith("mobilis-")
        ? { ...previous[id], "mobilis-credit": rate, "mobilis-offer": rate }
        : { ...previous[id], [serviceKey]: rate }
    }));
    closeEditor();
  };
  const showTest = (customer: Customer) => { setTestId(customer.id); setTestService(serviceKey || "mobilis-credit"); setTab("test"); };
  const updateTestService = (value: string) => {
    setTestService(value);
    setPurchaseDiscount(value === "mobilis-offer" ? 9 : 4);
    setFee(value === "mobilis-offer" ? 10 : 0);
  };
  const percentInput = (value: number | null, onChange: (next: number | null) => void) =>
    <InputNumber<number> min={0} max={100} step={0.5} precision={2} value={value}
      onChange={onChange} addonAfter="%" style={{ width: "100%" }} aria-label="نسبة تجريبية" />;

  const categorySelector = (insideModal: boolean) =>
    <Row gutter={[8, 8]} style={{ marginBottom: insideModal ? 12 : 0 }}>
      <Col xs={24} sm={12}>
        <Typography.Text type="secondary">الفئة</Typography.Text>
        <Select value={category} onChange={changeCategory} aria-label={insideModal ? "الفئة داخل تعديل النسبة" : "فئة المنتجات"}
          style={{ width: "100%", marginTop: 5 }}
          options={categories.map(value => ({ value, label: categoryNames[value] }))} />
      </Col>
      <Col xs={24} sm={12}>
        <Typography.Text type="secondary">الخدمة الفرعية</Typography.Text>
        <Select value={currentService?.key} onChange={changeService} aria-label={insideModal ? "الخدمة الفرعية داخل تعديل النسبة" : "الخدمة الفرعية"}
          style={{ width: "100%", marginTop: 5 }} placeholder="لا توجد خدمات في هذه الفئة"
          showSearch optionFilterProp="label"
          options={servicesInCategory.map(service => ({ value: service.key, label: service.label }))} />
      </Col>
    </Row>;

  return <Space direction="vertical" size="middle" style={{ width: "100%" }}>
    <Space wrap>
      <Button icon={<ArrowRightOutlined />} onClick={onBack}>العودة للموقع الرئيسي</Button>
      <Tag color="purple" icon={<ExperimentOutlined />}>محاكاة فقط</Tag>
    </Space>
    <Alert type="warning" showIcon message="لا توجد تغييرات مالية أو حفظ حقيقي"
      description="نستعمل أسماء الحسابات المسجلة فقط. كل النسب أمثلة قابلة للتعديل مؤقتًا؛ إعادة فتح المحاكاة تمسح تغييراتها." />
    {loadError && <Alert type={customers.length ? "warning" : "error"} showIcon message={loadError}/>}
    <Card size="small" title="اختيار الفئة والخدمة">{categorySelector(false)}</Card>
    <Tabs activeKey={tab} onChange={setTab} items={[
      { key: "customers", label: "نسب الزبائن", children:
        <Card title="الزبائن الموجودون" size="small" extra={<Tag>{filteredCustomers.length} زبون</Tag>}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Row gutter={[8, 8]}>
              <Col xs={24} sm={14}>
                <Input.Search allowClear placeholder="بحث باسم الزبون" value={query} onChange={event => setQuery(event.target.value)}/>
              </Col>
              <Col xs={24} sm={10}>
                <Select value={accountStatus} onChange={setAccountStatus} aria-label="حالة الزبائن" style={{ width: "100%" }}
                  options={[
                    { value: "all", label: "كل الزبائن" },
                    { value: "active", label: "النشطون فقط" },
                    { value: "inactive", label: "المعطّلون فقط" }
                  ]}/>
              </Col>
            </Row>
            <Table<Customer> size="small" tableLayout="fixed" rowKey="id" loading={loading}
              dataSource={currentService ? filteredCustomers : []}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              columns={[
                { title: "الزبون", dataIndex: "username", key: "username", width: "45%",
                  render: (username: string) => <Typography.Text style={{ overflowWrap: "anywhere" }}>{username}</Typography.Text> },
                { title: "النسبة", key: "rate", width: "23%", align: "center",
                  render: (_: unknown, customer: Customer) => <Typography.Text strong>
                    {percent(accountRates[customer.id]?.[serviceKey] ?? 0)}
                  </Typography.Text> },
                { title: "الإجراء", key: "edit", width: "32%", align: "center",
                  render: (_: unknown, customer: Customer) => <Button size="small" onClick={() => openEditor(customer)}>تعديل</Button> }
              ]}
              locale={{ emptyText: <Empty description={currentService ? "لا يوجد زبائن مطابقون" : "اختر خدمة متاحة أولاً"} /> }}/>
            {currentService && filteredCustomers.length > 0 &&
              <Button size="small" block onClick={() => showTest(filteredCustomers[0])}>تجربة ربح العملية لأحد الزبائن</Button>}
          </Space>
        </Card> },
      { key: "defaults", label: "الافتراضي", children:
        <Card size="small" title="نسبة افتراضية — محاكاة">
          <Alert type="info" showIcon message="تعديل هذه القيمة لا يؤثر على أي زبون قديم، ولا يُحفظ في الإنتاج." style={{ marginBottom: 14 }}/>
          {currentService ? <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Typography.Text strong>{currentService.label}</Typography.Text>
            {percentInput(defaults[serviceKey] ?? 0, value => {
              if (validRate(value)) setDefaults(previous => ({ ...previous, [serviceKey]: value }));
            })}
          </Space> : <Empty description="لا توجد منتجات في الفئة المختارة" />}
        </Card> },
      { key: "test", label: "تجربة ربح العملية", children:
        <Card size="small" title="حاسبة افتراضية للربح والخسارة">
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <Typography.Text>الزبون الموجود</Typography.Text>
              <Select value={testId} onChange={setTestId} style={{ width: "100%", marginTop: 5 }}
                options={customers.map(customer => ({ value: customer.id, label: customer.username }))}/>
            </Col>
            <Col xs={24} sm={12}>
              <Typography.Text>الخدمة</Typography.Text>
              <Select value={testService} onChange={updateTestService} style={{ width: "100%", marginTop: 5 }}
                options={services.map(service => ({ value: service.key, label: service.label }))}/>
            </Col>
            <Col xs={24} sm={12}>
              <Typography.Text>قيمة العملية (دج)</Typography.Text>
              <InputNumber min={1} max={1000000} value={amount} onChange={value => { if (value !== null) setAmount(value); }}
                style={{ width: "100%", marginTop: 5 }}/>
            </Col>
            <Col xs={24} sm={12}>
              <Typography.Text>خصم الزبون: <strong>{percent(testedRate)}</strong></Typography.Text>
            </Col>
            <Col xs={24} sm={12}>
              <Typography.Text>خصم شراء المصدر — افتراضي</Typography.Text>
              {percentInput(purchaseDiscount, value => { if (validRate(value)) setPurchaseDiscount(value); })}
            </Col>
            <Col xs={24} sm={12}>
              <Typography.Text>رسوم المصدر (دج)</Typography.Text>
              <InputNumber min={0} max={100000} value={fee}
                onChange={value => { if (value !== null) setFee(value); }} style={{ width: "100%", marginTop: 5 }}/>
            </Col>
          </Row>
          <div style={{ margin: "14px 0" }}>
            <Checkbox checked={sourceReady} onChange={event => setSourceReady(event.target.checked)}>
              المصدر جاهز ورصيده كافٍ (افتراض)
            </Checkbox>
          </div>
          {testing ? <Card size="small">
            <Space direction="vertical">
              <Typography.Text>الزبون: <strong>{testing.username}</strong></Typography.Text>
              <Typography.Text>المبلغ على الزبون: <strong>{dinars(revenue)}</strong></Typography.Text>
              <Typography.Text>التكلفة: <strong>{dinars(purchaseCost)}</strong></Typography.Text>
              {sourceReady ? <Typography.Text strong style={{ color: margin < 0 ? "#cf1322" : "#237804" }}>
                {margin < 0 ? "خسارة" : "ربح"}: {dinars(Math.abs(margin))}
              </Typography.Text> : <Alert type="warning" showIcon message="المصدر غير متاح، لا يمكن اختياره"/>}
            </Space>
          </Card> : <Empty description="اختر زبونًا موجودًا" />}
          <Alert type="info" showIcon style={{ marginTop: 12 }}
            message="الحاسبة توضيحية فقط؛ ليست اختيار شريحة ولا شحنًا حقيقيًا."/>
        </Card> }
    ]}/>
    <Modal title={editing ? "تعديل نسبة " + editing.username : "تعديل نسبة الزبون"} open={editingId !== null}
      onCancel={closeEditor} onOk={applyEditedRate} okText="تطبيق تجريبي" cancelText="إلغاء"
      okButtonProps={{ disabled: !currentService || !validRate(draftRate) }} destroyOnHidden>
      {editing && <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Alert type="info" showIcon message="هذه معاينة فقط؛ لن تتغير بيانات حساب الزبون." />
        <Typography.Text>اسم المستخدم: <strong>{editing.username}</strong></Typography.Text>
        {categorySelector(true)}
        {currentService ? <>
          <Typography.Text strong>النسبة المئوية</Typography.Text>
          {percentInput(draftRate, setDraftRate)}
          {category === "flexy" && serviceKey.startsWith("mobilis-") &&
            <Checkbox checked={applyBoth} onChange={event => setApplyBoth(event.target.checked)}>
              تطبيق نفس النسبة على موبيليس العادي والمفعّل معًا
            </Checkbox>}
        </> : <Empty description="اختر خدمة فرعية متاحة"/>}
      </Space>}
    </Modal>
  </Space>;
}
