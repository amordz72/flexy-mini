import { useEffect, useRef, useState } from "react";
import { Alert, Card, Descriptions, Empty, Table, Tag, Typography } from "antd";
import type { SupabaseClient } from "@supabase/supabase-js";

type Filters = { from: string; to: string; operator: string; status: string };
type Order = {
  id: number;
  created_at: string;
  operator: string | null;
  service_type: string | null;
  status: string;
  face_amount: number | string | null;
  recorded_sale_price: number | string | null;
  recorded_profit: number | string | null;
  applied_rate: number | string | null;
  result_code: string | null;
  inferred_success: boolean;
};
type Read = { read_only: boolean; source: string; total: number; rows: Order[]; limit: number; offset: number };
const statusLabel: Record<string, string> = {
  success: "نجاح مسجل", failed: "فشل", review: "مراجعة",
  queued: "منتظر", claimed: "جارٍ", unavailable: "غير متاح"
};
const cash = (v: number | string | null) =>
  v === null || v === undefined ? "غير متوفر" :
  Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " دج";
const when = (v: string) => new Date(v).toLocaleString("en-GB", {
  timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit"
});

export default function FinancialReportOrders({ db, filters, active }: {
  db: SupabaseClient; filters: Filters; active: boolean;
}) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Read | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);

  useEffect(() => {
    setPage(1);
    setResult(null);
  }, [filters]);
  useEffect(() => {
    if (!active) return;
    const current = ++sequence.current;
    let alive = true;
    setLoading(true);
    setError("");
    void Promise.resolve(db.rpc("flexy_mini_admin_financial_report_orders", {
      p_from: filters.from, p_to: filters.to, p_operator: filters.operator,
      p_status: filters.status, p_limit: 10, p_offset: (page - 1) * 10
    })).then(({ data, error: rpcError }) => {
      if (!alive || current !== sequence.current) return;
      if (rpcError) throw rpcError;
      if (!data || data.read_only !== true || data.source !== "public.flexy_orders" ||
          !Array.isArray(data.rows) || !Number.isFinite(Number(data.total))) {
        throw new Error("نتيجة تفاصيل العمليات غير مطابقة");
      }
      setResult(data as Read);
    }).catch(problem => {
      if (!alive || current !== sequence.current) return;
      setResult(null);
      setError("تعذر قراءة تفاصيل العمليات: " +
        (problem instanceof Error ? problem.message : String(problem)));
    }).finally(() => {
      if (alive && current === sequence.current) setLoading(false);
    });
    return () => { alive = false; sequence.current++; };
  }, [db, filters, active, page]);

  return <Card size="small" title="تفاصيل عمليات الفليكسي المسجلة">
    <Alert showIcon type="info" style={{ marginBottom: 12 }}
      message="هذه تفاصيل الطلبات التاريخية وليس كشفًا بالمبالغ المحصّلة"
      description="نحترم الفلتر والفترة نفسها. لا نظهر أرقام هواتف الزبائن ولا ردود الشبكة الخام."/>
    {error && <Alert showIcon type="error" message={error} style={{ marginBottom: 12 }}/>}
    <Table<Order> size="small" rowKey="id" tableLayout="fixed" loading={loading}
      dataSource={result?.rows || []}
      pagination={{ current: page, total: Number(result?.total || 0), pageSize: 10,
        showSizeChanger: false, onChange: setPage }}
      locale={{ emptyText: <Empty description="لا توجد عمليات في الفترة المختارة" /> }}
      columns={[
        { title: "التاريخ", key: "date", width: "35%",
          render: (_: unknown, row: Order) =>
            <Typography.Text style={{ fontSize: 12 }}>{when(row.created_at)}</Typography.Text> },
        { title: "القيمة الاسمية", dataIndex: "face_amount", key: "face", width: "30%",
          render: (value: number | string | null) =>
            <Typography.Text style={{ fontSize: 12 }}>{cash(value)}</Typography.Text> },
        { title: "الحالة", key: "status", width: "35%",
          render: (_: unknown, row: Order) =>
            <Tag color={row.inferred_success ? "orange" :
              row.status === "success" ? "green" :
              row.status === "failed" ? "red" : "default"}>
              {row.inferred_success ? "نجاح مستنتج*" : statusLabel[row.status] || row.status}
            </Tag> }
      ]}
      expandable={{
        expandedRowRender: row => <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="مرجع الطلب">#{row.id}</Descriptions.Item>
          <Descriptions.Item label="الشبكة">{row.operator || "—"}</Descriptions.Item>
          <Descriptions.Item label="الخدمة">{row.service_type || "—"}</Descriptions.Item>
          <Descriptions.Item label="الربح المحفوظ">{cash(row.recorded_profit)}</Descriptions.Item>
          <Descriptions.Item label="مبلغ البيع المحفوظ">{cash(row.recorded_sale_price)}</Descriptions.Item>
          <Descriptions.Item label="نسبة العملية">{row.applied_rate === null ? "غير متوفرة" : row.applied_rate + "%"}</Descriptions.Item>
          <Descriptions.Item label="رمز النتيجة">{row.result_code || "—"}</Descriptions.Item>
        </Descriptions>
      }}/>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      * نجاح مستنتج من مهلة اتصال أو تغيّر رصيد؛ لا تثبت هذه الحالة وحدها وصول الخدمة.
      لم يتم تعديل أي طلب قديم.
    </Typography.Text>
  </Card>;
}
