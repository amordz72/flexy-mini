import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Empty, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import type { SupabaseClient } from "@supabase/supabase-js";

type Offer = {
  family?: string | null;
  label?: string | null;
  amount?: number | string | null;
  index?: string | null;
};
type Discovery = {
  job_uuid: string;
  status: string;
  family: string | null;
  result_code: string | null;
  phone_masked: string | null;
  available_offers: Offer[] | null;
  created_at: string;
  completed_at: string | null;
};
type QueueReply = { job_uuid: string; station_uuid: string; status: string; reused: boolean };

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("213") && digits.length === 12 ? "0" + digits.slice(3) : digits;
}
function offersOf(row: Discovery): Offer[] {
  return (Array.isArray(row.available_offers) ? row.available_offers : [])
    .filter(offer => Number(offer.amount) >= 500);
}
function statusLabel(status: string): string {
  if (status === "success") return "اكتمل";
  if (status === "claimed" || status === "queued") return "قيد التنفيذ";
  if (status === "review") return "يحتاج مراجعة";
  if (status === "failed") return "فشل";
  return status || "غير معروف";
}
function statusColor(status: string): string {
  return status === "success" ? "green" : status === "claimed" || status === "queued" ? "blue" : "orange";
}

export default function SamaOfferDiscoveries({ db, stationUuid, samaReady, historyOnly=false }: {
  db: SupabaseClient;
  stationUuid: string | null;
  samaReady: boolean;
  historyOnly?: boolean;
}) {
  const [history, setHistory] = useState<Discovery[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentJob, setCurrentJob] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const response = await db.rpc("flexy_mini_admin_sama_offer_discoveries", { p_limit: 20 });
    setLoading(false);
    if (response.error) {
      setError("تعذر قراءة سجل عروض Sama: " + response.error.message);
      return;
    }
    const rows = (Array.isArray(response.data) ? response.data : []) as Discovery[];
    setHistory(rows);
    setError("");
    setSelected(previous => previous && rows.some(row => row.job_uuid === previous)
      ? previous
      : (rows[0]?.job_uuid || null));
  }, [db]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const refresh = async () => {
    await loadHistory();
    if (!currentJob) return;
    const response = await db.rpc("station_connect_admin_offer_discovery_job", {
      p_job_uuid: currentJob,
    });
    if (response.error) {
      message.error("تعذر قراءة نتيجة الطلب: " + response.error.message);
      return;
    }
    const found = Array.isArray(response.data) ? response.data[0] : response.data;
    if (found && typeof found.status === "string") setCurrentStatus(found.status);
  };

  const submit = () => {
    const target = normalizePhone(phone);
    if (!/^0[5-7]\d{8}$/.test(target)) {
      message.warning("اكتب رقم الهاتف الجزائري بصيغة 0XXXXXXXXX");
      return;
    }
    if (!stationUuid) {
      message.warning("اختر محطة Sama من زر «عرض مودمات المحطة» أولًا");
      return;
    }
    if (!samaReady) {
      message.warning("لا توجد شريحة Sama حديثة الظهور وبها PIN محفوظ على محطة متصلة. حدّث المودم أو جهّز الشريحة أولًا.");
      return;
    }
    if (busy || currentStatus === "claimed" || currentStatus === "queued") {
      message.warning("توجد عملية استكشاف قيد التنفيذ. اضغط تحديث لمتابعتها");
      return;
    }
    Modal.confirm({
      title: "تأكيد اكتشاف عروض Mobilis Sama",
      content: "سيُرسل Station Connect استعلام عروض للشريحة عبر الشبكة للرقم المحدد. لا ينفّذ بيعًا أو تحويلًا ماليًا، لكنه يتصل فعليًا بخدمة USSD. تأكد أن محطة Sama موصولة وأن الرقم صحيح.",
      okText: "إرسال الاستعلام",
      cancelText: "إلغاء",
      onOk: async () => {
        setBusy(true);
        try {
          const response = await db.rpc("station_connect_admin_create_offer_discovery", {
            p_phone: target,
            p_station_uuid: stationUuid,
          });
          if (response.error) {
            message.error("تعذر إنشاء الاستعلام: " + response.error.message);
            return;
          }
          const result = (Array.isArray(response.data) ? response.data[0] : response.data) as QueueReply | null;
          if (result?.job_uuid) {
            setCurrentJob(result.job_uuid);
            setCurrentStatus(result.status);
            message.success(result.reused ? "عملية سابقة ما زالت جارية، لم نكررها" : "تم إنشاء طلب اكتشاف عروض Sama");
          } else {
            message.warning("لم يرجع السيرفر رقم عملية؛ يرجى التحقق من حالة الاتصال");
          }
          await loadHistory();
        } catch (cause) {
          message.error("تعذر الاتصال بالسيرفر: " + (cause instanceof Error ? cause.message : "خطأ غير معروف"));
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const current = history.find(row => row.job_uuid === selected) || null;
  return <Card
    title="اكتشاف عروض Mobilis Sama"
    extra={<Button onClick={() => void refresh()} loading={loading}>تحديث النتائج</Button>}
  >
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert type="info" showIcon message="سجل Sama — للقراءة فقط" description="تظهر آخر 20 عملية استكشاف محفوظة في Station Connect، بما فيها النتائج القديمة. نعرض العروض ابتداءً من 500 دج؛ وجود عرض بالسجل لا يعني توفره الآن. لا يُرسل أي USSD عند فتح الصفحة أو الضغط على تحديث النتائج." />
      {error && <Alert type="error" showIcon message={error} />}
      {!historyOnly && <>
      <Typography.Text strong>طلب استكشاف جديد (إدارة فقط)</Typography.Text>
      <Space.Compact style={{ width: "100%" }}>
        <Input
          aria-label="رقم الزبون المراد استكشاف عروض Sama له"
          dir="ltr"
          inputMode="tel"
          placeholder="0XXXXXXXXX"
          maxLength={20}
          value={phone}
          onChange={event => setPhone(event.target.value)}
          onPressEnter={submit}
        />
        <Button type="primary" disabled={!stationUuid || !samaReady || busy || currentStatus === "claimed" || currentStatus === "queued"} loading={busy} onClick={submit}>استكشاف</Button>
      </Space.Compact>
      {!stationUuid && <Typography.Text type="secondary">اختر المحطة من الأعلى لتمكين استعلام الشبكة.</Typography.Text>}
      {stationUuid && !samaReady && <Alert type="warning" showIcon message="Sama غير جاهزة للاستكشاف" description="المحطة قد تكون متصلة، لكن يلزم ظهور شريحة من نوع mobilis-sama حديثًا مع PIN الخدمة محفوظ. استخدم «عرض مودمات المحطة» ثم «تجهيز Mobilis Sama» للشريحة الصحيحة."/>}
      {currentJob && <Alert
        type="info"
        showIcon
        message={"آخر طلب: " + statusLabel(currentStatus || "queued")}
        description={"مرجع الطلب: " + currentJob + " — اضغط «تحديث النتائج» لمتابعة الرد."}
      />}
      </>}
      <Typography.Text strong>آخر عمليات الاستكشاف</Typography.Text>
      {history.length === 0 && !loading ? <Empty description="لا توجد عمليات Sama محفوظة" /> : <Table<Discovery>
        rowKey="job_uuid"
        loading={loading}
        size="small"
        scroll={{ x: 500 }}
        pagination={{ pageSize: 5 }}
        dataSource={history}
        rowSelection={{ type: "radio", selectedRowKeys: selected ? [selected] : [], onChange: keys => setSelected(String(keys[0] || "")) }}
        columns={[
          { title: "الوقت", dataIndex: "created_at", render: (v: string) => v ? new Date(v).toLocaleString("ar-DZ") : "—" },
          { title: "الحالة", dataIndex: "status", render: (v: string) => <Tag color={statusColor(v)}>{statusLabel(v)}</Tag> },
          { title: "العروض", render: (_: unknown, record: Discovery) => offersOf(record).length },
          { title: "الفئة", dataIndex: "family", render: (v: string | null) => v || "متعددة" },
        ]}
      />}
      {current && <Card size="small" title={"عروض العملية المحددة — " + (current.family || "كل الفئات")}>
        {(!current.completed_at || !Number.isFinite(Date.parse(current.completed_at)) || Date.now() - Date.parse(current.completed_at) > 7 * 24 * 60 * 60 * 1000) && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="بيانات اكتشاف قديمة أو غير مؤرخة" description="هذه نتيجة محفوظة، وليست تأكيدًا حيًا لتوفر العرض. لا نستعمل ترتيب القائمة في تنفيذ شحن دون تحقق جديد وصريح." />}
        {offersOf(current).length === 0 ? <Empty description="لا توجد عروض قابلة للعرض في هذه النتيجة" /> : <Table<Offer>
          rowKey={(offer, index) => String(offer.family || "") + ":" + String(offer.index || index) + ":" + String(offer.amount || "")}
          dataSource={offersOf(current)}
          size="small"
          pagination={false}
          columns={[
            { title: "العرض", render: (_: unknown, offer: Offer) => offer.label || offer.family || "غير مسمى" },
            { title: "الفئة", dataIndex: "family", render: (v: string | null) => v || "—" },
            { title: "الترتيب المحفوظ", dataIndex: "index", render: (v: string | null) => v || "—" },
            { title: "القيمة (دج)", dataIndex: "amount", render: (v: number | string | null) => v ?? "—" },
          ]}
        />}
      </Card>}
    </Space>
  </Card>;
}
