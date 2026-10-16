import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Col, Empty, Input, Row, Select, Space, Spin, Table, Tabs, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { SupabaseClient } from "@supabase/supabase-js";
import FinancialReportOrders from "./FinancialReportOrders";
import FinancialExpenses from "./FinancialExpenses";

type ReportSummary = {
  total_orders: number;
  success_status_count: number;
  failed_count: number;
  other_status_count: number;
  inferred_success_count: number;
  success_nominal_amount: number | string;
  all_status_nominal_amount: number | string;
  success_with_revenue_count: number;
  success_with_profit_count: number;
  recorded_revenue: number | string | null;
  recorded_direct_profit: number | string | null;
  expenses: null;
  net_profit: null;
};
type Group = {
  operator: string | null;
  service_type: string | null;
  total_orders: number;
  success_status_count: number;
  failed_count: number;
  other_status_count: number;
  inferred_success_count: number;
  success_nominal_amount: number | string;
  success_with_profit_count: number;
  recorded_revenue: number | string | null;
  recorded_direct_profit: number | string | null;
};
type Report = {
  source: string;
  read_only: boolean;
  from: string;
  to: string;
  date_timezone: string;
  summary: ReportSummary;
  groups: Group[];
  coverage: { flexy_orders: boolean; cards_and_games: boolean; idoom: boolean; expenses_registered: boolean; net_profit_available: boolean };
};
type Filters = { from: string; to: string; operator: string; status: string };
const operatorNames: Record<string, string> = { mobilis: "موبيليس", djezzy: "جيزي", ooredoo: "أوريدو" };
const serviceNames: Record<string, string> = { balance: "رصيد عادي", offer: "عرض مفعّل", offers: "عروض" };
const formatCash = (amount: number | string) =>
  Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " دج";
const knownCash = (amount: number | string | null) => amount === null || amount === undefined
  ? "غير متوفر" : formatCash(amount);
const todayInAlgeria = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = (kind: string) => parts.find(piece => piece.type === kind)?.value || "01";
  return part("year") + "-" + part("month") + "-" + part("day");
};
const initialFilters = (): Filters => {
  const to = todayInAlgeria();
  return { from: to.slice(0, 7) + "-01", to, operator: "all", status: "all" };
};
const groupTitle = (group: Group) =>
  (operatorNames[group.operator || ""] || group.operator || "غير مصنف") + " — " +
  (serviceNames[group.service_type || ""] || group.service_type || "خدمة غير مصنفة");

export default function FinancialReports({ db }: { db: SupabaseClient }) {
  const [inputs, setInputs] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("activity");
  const sequence = useRef(0);

  useEffect(() => {
    const request = ++sequence.current;
    let alive = true;
    setLoading(true);
    setError("");
    // No direct table SELECT, and no debit/credit/USSD operation.
    void Promise.resolve(db.rpc("flexy_mini_admin_financial_report", {
      p_from: applied.from, p_to: applied.to,
      p_operator: applied.operator, p_status: applied.status
    })).then(({ data, error: readError }) => {
      if (!alive || request !== sequence.current) return;
      if (readError) throw readError;
      if (!data || data.read_only !== true || data.source !== "public.flexy_orders" ||
          !Array.isArray(data.groups) || !data.summary || !data.coverage) {
        throw new Error("تقرير غير مطابق لمصدر السجلات المعتمد");
      }
      setReport(data as Report);
    }).catch(problem => {
      if (!alive || request !== sequence.current) return;
      setReport(null);
      setError("تعذر قراءة التقرير: " + (problem instanceof Error ? problem.message : String(problem)));
    }).finally(() => {
      if (alive && request === sequence.current) setLoading(false);
    });
    return () => { alive = false; sequence.current++; };
  }, [db, applied, revision]);

  const apply = () => {
    if (!inputs.from || !inputs.to || inputs.from > inputs.to) {
      setError("حدد تاريخ البداية والنهاية بالترتيب الصحيح");
      return;
    }
    const distance = (Date.parse(inputs.to + "T00:00:00Z") - Date.parse(inputs.from + "T00:00:00Z")) / 86400000;
    if (!Number.isFinite(distance) || distance > 1095) {
      setError("أقصى مدة للتقرير 1096 يومًا");
      return;
    }
    setApplied({ ...inputs });
    setRevision(value => value + 1);
  };
  const chooseThisMonth = () => {
    const now = todayInAlgeria();
    const next = { ...inputs, from: now.slice(0, 7) + "-01", to: now };
    setInputs(next);
    setApplied(next);
    setRevision(value => value + 1);
  };
  const chooseMonth = (yearMonth: string) => {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) return;
    const [year, month] = yearMonth.split("-").map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const next = { ...inputs, from: yearMonth + "-01", to: yearMonth + "-" + String(lastDay).padStart(2, "0") };
    setInputs(next);
    setApplied(next);
    setRevision(value => value + 1);
  };
  // CSV contains only the filtered report's summary and grouped rows, NOT every order.
  const exportSummaryCsv = () => {
    if (!report || loading || error) return;
    const safe = (value: unknown) => {
      let content = String(value === null || value === undefined ? "غير متوفر" : value);
      if (/^[=+@]|^-(?!\d)|^[\t\r]/.test(content)) content = "'" + content;
      return '"' + content.replace(/"/g, '""') + '"';
    };
    const fields: unknown[][] = [
      ["المصدر", report.source],
      ["من تاريخ", report.from], ["إلى تاريخ", report.to],
      ["الشبكة", applied.operator], ["حالة الطلب", applied.status],
      ["ملاحظة", "القيمة الاسمية ليست مبلغًا محصلًا، والنجاح قد يكون مستنتجًا"],
      ["المؤشر", "القيمة"],
      ["عدد الطلبات", report.summary.total_orders],
      ["حالات نجاح مسجلة", report.summary.success_status_count],
      ["حالات نجاح مستنتجة", report.summary.inferred_success_count],
      ["حالات فشل", report.summary.failed_count],
      ["طلبات بقيمة اسمية إجمالية", report.summary.all_status_nominal_amount],
      ["طلبات نجاح بقيمة اسمية", report.summary.success_nominal_amount],
      ["مبيعات محفوظة مكتملة", report.summary.recorded_revenue],
      ["ربح مباشر محفوظ مكتمل", report.summary.recorded_direct_profit],
      ["مصاريف المنصة", "ارجع إلى سجل مصاريف Flexy Mini الخاص بالفترة"], ["صافي الربح", "غير مكتمل"],
      [],
      ["الشبكة", "الخدمة", "كل الطلبات", "حالات نجاح", "حالات نجاح مستنتجة",
        "القيمة الاسمية للنجاح", "ربح مباشر محفوظ مكتمل"]
    ];
    for (const group of report.groups) fields.push([
      group.operator ?? "غير مصنف", group.service_type ?? "غير مصنف",
      group.total_orders, group.success_status_count, group.inferred_success_count,
      group.success_nominal_amount, group.recorded_direct_profit
    ]);
    const csv = "\uFEFF" + fields.map(row => row.map(safe).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flexy-report-summary-" + report.from + "-" + report.to + ".csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const summary = report?.summary;
  const metric = (label: string, value: string, emphasis: "none" | "good" = "none") =>
    <Col xs={12} sm={12} md={6}>
      <Card size="small" style={{ background: "#f8fafc", height: "100%" }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{label}</Typography.Text>
        <div style={{ marginTop: 8, fontWeight: 650, fontSize: 18, color: emphasis === "good" ? "#237804" : undefined, overflowWrap: "anywhere" }}>{value}</div>
      </Card>
    </Col>;
  const noNumbers = <Alert type="warning" showIcon message="لا نحسب قيمة غير محفوظة على أنها صفرًا"
    description="الطلبات القديمة لا تحمل ربحًا موثوقًا، وأرباح الألعاب وإيدوم غير مربوطة. المصاريف المسجلة مستقلة بالأسفل، لكن لا يمكن استخراج صافي ربح مكتمل."/>;
  const groupColumns = [
    { title: "الخدمة", key: "service", render: (_: unknown, item: Group) =>
      <Typography.Text style={{ overflowWrap: "anywhere" }}>{groupTitle(item)}</Typography.Text>, width: "45%" },
    { title: "الطلبات", dataIndex: "total_orders", key: "total", align: "center" as const, width: "21%" },
    { title: "الحالات الناجحة*", dataIndex: "success_status_count", key: "successful", align: "center" as const, width: "34%" }
  ];

  return <Space direction="vertical" size="middle" style={{ width: "100%" }}>
    <Alert type="info" showIcon message="التقارير — مصدر العمليات مستقل عن سجل مصاريف المنصة"
      description="الاستهلاك يقرأ flexy_orders فقط، ومصاريف Flexy Mini تُسجّل في سجل مستقل دون تأثير على المحفظة أو MyTool. لا نعتبر حالة نجاح تقنية تحصيلًا مثبتًا."/>
    <Card size="small" title="الفترة ونوع العمليات">
      <Row gutter={[8, 12]}>
        <Col xs={24} sm={8}>
          <Typography.Text type="secondary">اختيار الشهر مباشرة</Typography.Text>
          <Input type="month" aria-label="اختيار الشهر" value={inputs.from.slice(0, 7)}
            onChange={e => chooseMonth(e.target.value)} style={{ marginTop: 5 }}/>
        </Col>
        <Col xs={12} sm={8}><Typography.Text type="secondary">من تاريخ</Typography.Text>
          <Input type="date" aria-label="من تاريخ" value={inputs.from} onChange={e => setInputs(old => ({ ...old, from: e.target.value }))} style={{ marginTop: 5 }}/></Col>
        <Col xs={12} sm={8}><Typography.Text type="secondary">حتى تاريخ</Typography.Text>
          <Input type="date" aria-label="حتى تاريخ" value={inputs.to} onChange={e => setInputs(old => ({ ...old, to: e.target.value }))} style={{ marginTop: 5 }}/></Col>
        <Col xs={12} sm={4}><Typography.Text type="secondary">الشبكة</Typography.Text>
          <Select style={{ width: "100%", marginTop: 5 }} value={inputs.operator} onChange={operator => setInputs(old => ({ ...old, operator }))}
            options={[{ value: "all", label: "الكل" }, ...Object.entries(operatorNames).map(([value,label])=>({value,label}))]}/></Col>
        <Col xs={12} sm={4}><Typography.Text type="secondary">الحالة</Typography.Text>
          <Select style={{ width: "100%", marginTop: 5 }} value={inputs.status} onChange={status => setInputs(old => ({ ...old, status }))}
            options={[{ value: "all", label: "كل الحالات" },{ value: "success", label: "مسجلة نجاحًا" },
              { value: "failed", label: "فشلت" },{ value: "review", label: "تحتاج مراجعة" },
              { value: "queued", label: "منتظرة" },{ value: "claimed", label: "قيد المعالجة" },{ value: "unavailable", label: "غير متاحة" }]}/></Col>
      </Row>
      <Space wrap style={{ marginTop: 14 }}>
        <Button type="primary" onClick={apply} loading={loading}>عرض التقرير</Button>
        <Button onClick={chooseThisMonth}>هذا الشهر</Button>
        <Button icon={<ReloadOutlined />} onClick={() => setRevision(value => value + 1)} loading={loading}>تحديث</Button>
        <Button disabled={!report || loading || Boolean(error)} onClick={exportSummaryCsv}>تصدير ملخص CSV</Button>
        <Button disabled={!report || loading || Boolean(error)} onClick={() => window.print()}>طباعة</Button>
      </Space>
    </Card>
    {error && <Alert type="error" showIcon message={error}/>}
    {loading && <Spin/>}
    {report && summary && <>
      <Typography.Text type="secondary">الفترة المحسوبة: {report.from} ← {report.to} (الجزائر)</Typography.Text>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: "activity", label: "الاستهلاك", children: <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Row gutter={[8, 8]}>
            {metric("كل الطلبات", String(summary.total_orders))}
            {metric("حالتها نجاح*", String(summary.success_status_count), "good")}
            {metric("حالتها فشل", String(summary.failed_count))}
            {metric("غير محسومة", String(summary.other_status_count))}
          </Row>
          <Card size="small" title="قيم الطلبات الاسمية — ليست مبيعات محصلة">
            <Row gutter={[8, 8]}>
              {metric("إجمالي الطلبات", formatCash(summary.all_status_nominal_amount))}
              {metric("المسجلة نجاحًا*", formatCash(summary.success_nominal_amount))}
              {metric("نجاح مستنتج تقنيًا", String(summary.inferred_success_count))}
              {metric("مبيعات مثبتة السعر", knownCash(summary.recorded_revenue))}
            </Row>
          </Card>
          <Card size="small" title="حسب الخدمة">
            <Table<Group> size="small" tableLayout="fixed" rowKey={row => (row.operator || "") + ":" + (row.service_type || "")}
              dataSource={report.groups} columns={groupColumns} pagination={{ pageSize: 10, showSizeChanger: false }}
              locale={{ emptyText: <Empty description="لا توجد طلبات ضمن الفترة والفلتر" /> }}/>
          </Card>
          <Alert showIcon type="warning"
            message="*نجاح الطلب حالة تقنية مسجلة، وليس بالضرورة تأكيدًا نهائيًا من الشبكة"
            description={summary.inferred_success_count > 0
              ? "منها " + summary.inferred_success_count + " حالة مبنية على مهلة أو استنتاج رصيد. لا تُحسب أرباحًا مؤكدة."
              : "راجع أدلة التنفيذ قبل اعتماد أي تسوية مالية."}/>
        </Space> },
        { key: "orders", label: "تفاصيل العمليات", children:
          <FinancialReportOrders db={db} filters={applied} active={tab === "orders"}/> },
        { key: "profit", label: "الأرباح والمصاريف", children: <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Row gutter={[8, 8]}>
            {metric("ربح الفليكسي المسجل", knownCash(summary.recorded_direct_profit))}
            {metric("ربح البطاقات والألعاب", "غير مربوط")}
            {metric("ربح إيدوم", "غير مربوط")}
            {metric("مصاريف المنصة", "التفصيل أدناه")}
          </Row>
          {noNumbers}
          <FinancialExpenses db={db} from={applied.from} to={applied.to} active={tab === "profit"}/>
          <Card size="small" title="نتيجة الفترة">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Typography.Text>عدد الحالات الناجحة تقنيًا: <b>{summary.success_status_count}</b></Typography.Text>
              <Typography.Text>منها ذات ربح محفوظ: <b>{summary.success_with_profit_count}</b></Typography.Text>
              <Typography.Text>المصاريف: <b>تُعرض في سجل Flexy Mini أدناه</b></Typography.Text>
              <Typography.Text strong>صافي الربح: <Tag>غير مكتمل — لا يمكن حسابه</Tag></Typography.Text>
            </Space>
          </Card>
          <Card size="small" title="الأرباح حسب الخدمة">
            {report.groups.length === 0 ? <Empty description="لا توجد طلبات"/> :
              <Space direction="vertical" style={{ width: "100%" }}>
                {report.groups.map(group => <Row key={(group.operator || "")+":"+(group.service_type || "")} justify="space-between" align="middle">
                  <Col flex="auto"><Typography.Text>{groupTitle(group)}</Typography.Text></Col>
                  <Col><Typography.Text strong>{knownCash(group.recorded_direct_profit)}</Typography.Text></Col>
                </Row>)}
              </Space>}
          </Card>
        </Space> }
      ]}/>
    </>}
  </Space>;
}
