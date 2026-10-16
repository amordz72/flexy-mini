import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Col, Empty, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from "antd";
import type { SupabaseClient } from "@supabase/supabase-js";

type Expense = {
  id: number; expense_date: string; category: string; title: string;
  amount: number | string; note: string; created_at: string;
  voided_at: string | null; void_reason: string | null;
};
type ExpenseList = {
  source: string; from: string; to: string; total_rows: number;
  active_rows: number; active_total: number | string; rows: Expense[];
};
type Draft = { date: string; category: string; title: string; amount: number | null; note: string };
const categories: Record<string, string> = {
  hosting: "استضافة وسيرفر", internet: "إنترنت واتصالات",
  subscription: "اشتراكات خدمات", equipment: "معدات وأجهزة",
  fees: "رسوم تشغيل", other: "مصاريف أخرى"
};
const currency = (v: number | string) =>
  Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " دج";
const initialDraft = (date: string): Draft => ({
  date, category: "hosting", title: "", amount: null, note: ""
});

export default function FinancialExpenses({ db, from, to, active }: {
  db: SupabaseClient; from: string; to: string; active: boolean;
}) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ExpenseList | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(to));
  const [requestKey, setRequestKey] = useState("");
  const [voidId, setVoidId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const sequence = useRef(0);

  useEffect(() => { setPage(1); setResult(null); }, [from, to]);
  useEffect(() => {
    if (!active) return;
    const current = ++sequence.current;
    let alive = true;
    setLoading(true);
    setError("");
    void Promise.resolve(db.rpc("flexy_mini_admin_expenses_list", {
      p_from: from, p_to: to, p_limit: 10, p_offset: (page - 1) * 10
    })).then(({ data, error: readError }) => {
      if (!alive || current !== sequence.current) return;
      if (readError) throw readError;
      if (!data || data.source !== "public.flexy_mini_operating_expenses" ||
        !Array.isArray(data.rows) || !Number.isFinite(Number(data.active_total))) {
        throw new Error("بيانات مصاريف غير مطابقة");
      }
      setResult(data as ExpenseList);
    }).catch(e => {
      if (!alive || current !== sequence.current) return;
      setResult(null);
      setError("تعذر قراءة المصاريف: " + (e instanceof Error ? e.message : String(e)));
    }).finally(() => {
      if (alive && current === sequence.current) setLoading(false);
    });
    return () => { alive = false; sequence.current++; };
  }, [db, from, to, page, revision, active]);

  const openAdd = () => {
    setDraft(initialDraft(to));
    setRequestKey(crypto.randomUUID());
    setError("");
    setShowAdd(true);
  };
  const validDraft = draft.date && draft.date >= from && draft.date <= to &&
    draft.title.trim().length > 0 && draft.title.trim().length <= 120 &&
    draft.amount !== null && Number.isFinite(draft.amount) &&
    draft.amount > 0 && draft.amount <= 100000000 &&
    Math.round(draft.amount * 100) === draft.amount * 100 &&
    draft.note.length <= 500;
  const create = async () => {
    if (!validDraft || !requestKey || saving) return;
    setSaving(true);
    setError("");
    try {
      const { error: rpcError } = await db.rpc("flexy_mini_admin_expense_create", {
        p_request_key: requestKey, p_expense_date: draft.date,
        p_category: draft.category, p_title: draft.title.trim(),
        p_amount: draft.amount, p_note: draft.note
      });
      if (rpcError) throw rpcError;
      setShowAdd(false);
      setPage(1);
      setRevision(old => old + 1);
    } catch (e) {
      setError("تعذر تسجيل المصروف: " + (e instanceof Error ? e.message : String(e)));
    } finally { setSaving(false); }
  };
  const voidExpense = async () => {
    if (voidId === null || voidReason.trim().length < 4 || saving) return;
    setSaving(true);
    setError("");
    try {
      const { error: rpcError } = await db.rpc("flexy_mini_admin_expense_void", {
        p_expense_id: voidId, p_reason: voidReason.trim()
      });
      if (rpcError) throw rpcError;
      setVoidId(null);
      setVoidReason("");
      setRevision(old => old + 1);
    } catch (e) {
      setError("تعذر إلغاء المصروف: " + (e instanceof Error ? e.message : String(e)));
    } finally { setSaving(false); }
  };

  return <Card size="small" title="مصاريف Flexy Mini">
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert type="info" showIcon
        message="مصاريف المنصة للفترة المختارة، مستقلة عن شبكة وحالة الطلب"
        description="لا تُخصم من المحفظة أو الكيس، ولا تُربط بمصاريف محلات MyTool. لا يمكن حساب صافي الربح حتى تكتمل بيانات أرباح الخدمات."/>
      <Row gutter={[8, 8]} align="middle">
        <Col xs={14}>
          <Typography.Text type="secondary" style={{ display: "block" }}>مجموع المصاريف المسجلة غير الملغاة</Typography.Text>
          <Typography.Text strong style={{ fontSize: 20 }}>
            {result ? currency(result.active_total) : loading ? "جارٍ التحميل..." : "غير متوفر"}
          </Typography.Text>
        </Col>
        <Col xs={10}><Button block type="primary" onClick={openAdd}>تسجيل مصروف</Button></Col>
      </Row>
      {result && <Typography.Text type="secondary">
        {result.active_rows} مصاريف فعالة — {result.total_rows - result.active_rows} مدخلات ملغاة
      </Typography.Text>}
      {error && <Alert type="error" showIcon message={error}/>}
      <Table<Expense> size="small" tableLayout="fixed" rowKey="id" loading={loading}
        dataSource={result?.rows || []}
        pagination={{ current: page, pageSize: 10, total: Number(result?.total_rows || 0),
          showSizeChanger: false, onChange: setPage }}
        locale={{ emptyText: <Empty description="لا توجد مصاريف مسجلة لهذه الفترة" /> }}
        columns={[
          { title: "المصروف", key: "title", width: "48%",
            render: (_: unknown, row: Expense) => <Space direction="vertical" size={1}>
              <Typography.Text style={{ overflowWrap: "anywhere" }}>{row.title}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {row.expense_date} · {categories[row.category] || row.category}
              </Typography.Text>
            </Space> },
          { title: "المبلغ", key: "amount", width: "32%",
            render: (_: unknown, row: Expense) => <Typography.Text delete={Boolean(row.voided_at)}
              strong={!row.voided_at} style={{ fontSize: 12 }}>{currency(row.amount)}</Typography.Text> },
          { title: "الإجراء", key: "action", width: "20%",
            render: (_: unknown, row: Expense) =>
              row.voided_at
                ? <Tag>ملغى</Tag>
                : <Button danger size="small" onClick={() => { setVoidId(row.id); setVoidReason(""); }}>إلغاء</Button> }
        ]}
        expandable={{ expandedRowRender: row =>
          <Space direction="vertical" size="small">
            <Typography.Text>ملاحظة: {row.note || "—"}</Typography.Text>
            {row.voided_at && <Typography.Text type="secondary">سبب الإلغاء: {row.void_reason}</Typography.Text>}
          </Space> }}/>
      <Modal title="تسجيل مصروف للمنصة" open={showAdd} onCancel={() => { if (!saving) setShowAdd(false); }}
        onOk={() => void create()} okText="حفظ المصروف" cancelText="إلغاء"
        confirmLoading={saving} okButtonProps={{ disabled: !validDraft }} closable={!saving}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert type="warning" showIcon message="هذا تسجيل محاسبي يدوي فقط، وليس دفعًا أو خصمًا من رصيد الحساب."/>
          <Typography.Text>تاريخ المصروف (ضمن الفترة المختارة)</Typography.Text>
          <Input type="date" value={draft.date} min={from} max={to}
            onChange={e => setDraft(old => ({ ...old, date: e.target.value }))}/>
          <Typography.Text>نوع المصروف</Typography.Text>
          <Select value={draft.category} style={{ width: "100%" }}
            onChange={category => setDraft(old => ({ ...old, category }))}
            options={Object.entries(categories).map(([value,label]) => ({ value,label }))}/>
          <Typography.Text>العنوان</Typography.Text>
          <Input value={draft.title} maxLength={120} placeholder="مثال: استضافة السيرفر"
            onChange={e => setDraft(old => ({ ...old, title: e.target.value }))}/>
          <Typography.Text>المبلغ (دج)</Typography.Text>
          <InputNumber<number> value={draft.amount} min={0.01} max={100000000} precision={2}
            style={{ width: "100%" }} onChange={amount => setDraft(old => ({ ...old, amount }))}/>
          <Typography.Text>ملاحظة اختيارية</Typography.Text>
          <Input.TextArea maxLength={500} rows={2} value={draft.note}
            onChange={e => setDraft(old => ({ ...old, note: e.target.value }))}/>
        </Space>
      </Modal>
      <Modal title="إلغاء المصروف دون حذفه" open={voidId !== null}
        onCancel={() => { if (!saving) setVoidId(null); }}
        onOk={() => void voidExpense()} okText="تأكيد الإلغاء" okType="danger"
        cancelText="رجوع" confirmLoading={saving}
        okButtonProps={{ disabled: voidReason.trim().length < 4 }} closable={!saving}>
        <Typography.Paragraph>يبقى المصروف محفوظًا في التاريخ، لكنه لا يدخل في المجموع بعد الإلغاء.</Typography.Paragraph>
        <Input.TextArea rows={2} maxLength={300} value={voidReason}
          placeholder="سبب الإلغاء (4 أحرف على الأقل)"
          onChange={e => setVoidReason(e.target.value)}/>
      </Modal>
    </Space>
  </Card>;
}
