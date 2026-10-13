import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, Space, Tag, Typography, message } from "antd";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OfferGroup = "SAMA" | "PIXX" | "REVOLUTION";
export type OfferIdentity = {
  phone: string;
  group: OfferGroup;
  discoveryUuid: string;
  discoveredAt: string;
  validUntil: string;
};

type LookupRow = {
  lookup_status: string;
  presentation_group: string | null;
  detected_family: string | null;
  discovery_uuid: string | null;
  discovered_at: string | null;
  valid_until: string | null;
  ttl_hours: number;
  active_job_uuid: string | null;
};
type DiscoveryJob = {
  job_uuid: string;
  status: string;
  result_code: string | null;
  family: string | null;
};
type Queued = { job_uuid: string; status: string; reused: boolean };
const groups: OfferGroup[] = ["SAMA", "PIXX", "REVOLUTION"];
const groupNames: Record<OfferGroup, string> = {
  SAMA: "Sama Mix / Talk / Net",
  PIXX: "PixX",
  REVOLUTION: "Revolution",
};
const normalize = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("213") && digits.length === 12 ? "0" + digits.slice(3) : digits;
};
const isPhone = (v: string) => /^0[5-7][0-9]{8}$/.test(v);
const inProgress = (status: string) => status === "queued" || status === "claimed";

export default function CustomerOfferIdentity({
  db, phone, stationUuid, isCustomer, onIdentity,
}: {
  db?: SupabaseClient;
  phone: string;
  stationUuid: string | null;
  isCustomer: boolean;
  onIdentity: (value: OfferIdentity | null) => void;
}) {
  const normalized = normalize(phone);
  const [row, setRow] = useState<LookupRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [jobUuid, setJobUuid] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState("");
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const check = useCallback(async () => {
    const seq = ++requestSequence.current;
    if (!db || !isPhone(normalized) || isCustomer) {
      setRow(null);
      onIdentity(null);
      return;
    }
    setLoading(true);
    const result = await db.rpc("flexy_mini_admin_customer_offer_identity", {
      p_phone: normalized,
    });
    if (seq !== requestSequence.current) return;
    setLoading(false);
    if (result.error) {
      setRow(null);
      onIdentity(null);
      setError("تعذر معرفة نوع عروض الرقم: " + result.error.message);
      return;
    }
    setError("");
    const value = (Array.isArray(result.data) ? result.data[0] : result.data) as LookupRow | undefined;
    setRow(value || null);
    if (value?.active_job_uuid) {
      setJobUuid(value.active_job_uuid);
      setJobStatus("claimed");
    }
    if (value?.lookup_status === "CLASSIFIED"
      && groups.includes(value.presentation_group as OfferGroup)
      && value.discovery_uuid && value.discovered_at && value.valid_until
      && Date.parse(value.valid_until) > Date.now()) {
      onIdentity({
        phone: normalized,
        group: value.presentation_group as OfferGroup,
        discoveryUuid: value.discovery_uuid,
        discoveredAt: value.discovered_at,
        validUntil: value.valid_until,
      });
    } else {
      onIdentity(null);
    }
  }, [db, normalized, isCustomer, onIdentity]);

  useEffect(() => {
    requestSequence.current += 1;
    setRow(null);
    setJobUuid(null);
    setJobStatus(null);
    setNetworkError("");
    setError("");
    onIdentity(null);
    if (!isPhone(normalized) || isCustomer || !db) return;
    const timeout = window.setTimeout(() => { void check(); }, 400);
    return () => { window.clearTimeout(timeout); requestSequence.current += 1; };
  }, [check, normalized, isCustomer, db, onIdentity]);

  const refresh = async () => {
    if (!db || !isPhone(normalized)) return;
    setNetworkError("");
    if (jobUuid && (!jobStatus || inProgress(jobStatus))) {
      setLoading(true);
      const result = await db.rpc("station_connect_admin_offer_discovery_job", {
        p_job_uuid: jobUuid,
      });
      setLoading(false);
      if (result.error) {
        setError("تعذر قراءة الجلسة: " + result.error.message);
        return;
      }
      const job = (Array.isArray(result.data) ? result.data[0] : result.data) as DiscoveryJob | null;
      if (!job) {
        setError("جلسة الاستكشاف غير موجودة. لا نعيد المحاولة تلقائيًا.");
        return;
      }
      setJobStatus(job.status);
      if (inProgress(job.status)) {
        message.info("الجلسة ما زالت جارية. لن ننشئ جلسة ثانية.");
        return;
      }
      if (job.status !== "success") {
        setNetworkError("لم يكتمل استعلام الشبكة (" + (job.result_code || job.status)
          + "). لا نستنتج أن الزبون بلا عروض، ولا نكرر الاستعلام تلقائيًا.");
      }
    }
    await check();
  };

  const requestDiscovery = () => {
    if (!db || isCustomer || !isPhone(normalized) || sending) return;
    if (jobUuid && (!jobStatus || inProgress(jobStatus))) {
      message.warning("توجد جلسة استكشاف جارية. حدّث نتيجتها أولًا.");
      return;
    }
    if (!stationUuid) {
      message.warning("شريحة Mobilis Sama غير جاهزة؛ جهزها في «المحطات والشرائح» أولًا.");
      return;
    }
    Modal.confirm({
      title: "فتح جلسة معرفة عروض الرقم",
      content: "سيرسل Station Connect استعلام USSD لشريحة Sama لمعرفة مجموعة عروض الرقم "
        + normalized + ". لا يختار عرضًا ولا ينفذ شحنًا. لن نكرر الاستعلام آليًا إذا فشل.",
      okText: "فتح جلسة استعلام",
      cancelText: "إلغاء",
      onOk: async () => {
        setSending(true);
        setNetworkError("");
        setError("");
        try {
          const result = await db.rpc("station_connect_admin_create_offer_discovery", {
            p_phone: normalized,
            p_station_uuid: stationUuid,
          });
          if (result.error) {
            setError("تعذر فتح الجلسة: " + result.error.message);
            return;
          }
          const queued = (Array.isArray(result.data) ? result.data[0] : result.data) as Queued | null;
          if (!queued?.job_uuid) {
            setError("السيرفر لم يرجع رقم جلسة. لا تعاود الاستعلام قبل التحقق.");
            return;
          }
          setJobUuid(queued.job_uuid);
          setJobStatus(queued.status);
          message.info(queued.reused ? "جلسة سابقة ما زالت جارية؛ لم نكررها" : "تم فتح جلسة استعلام واحدة");
          await check();
        } catch {
          setError("انقطع الاتصال؛ قد تكون الجلسة بدأت. لا تعاود إرسال الطلب قبل التحقق.");
        } finally {
          setSending(false);
        }
      },
    });
  };

  if (!isPhone(normalized)) {
    return <Alert showIcon type="info" message="أدخل رقم الزبون لمعرفة نوع عروضه" />;
  }
  if (isCustomer) {
    return <Alert showIcon type="info" message="نوع عروض هذا الرقم غير متحقق بعد"
      description="الاستعلام الخاص بالزبائن يحتاج ربط مصادقة الحساب بالخادم. لا نعرض عروضًا غير مؤكدة ولا نكشف معلومات أرقام أخرى." />;
  }

  const classified = row?.lookup_status === "CLASSIFIED" && groups.includes(row.presentation_group as OfferGroup)
    && Boolean(row.valid_until && Date.parse(row.valid_until) > Date.now());
  return <Space direction="vertical" size="small" style={{ width:"100%" }}>
    {error && <Alert showIcon type="error" message={error} />}
    {networkError && <Alert showIcon type="warning" message={networkError} />}
    {loading && <Typography.Text type="secondary">جاري فحص آخر استكشاف محفوظ...</Typography.Text>}
    {classified ? <Alert type="success" showIcon
      message={"نوع عروض الرقم: " + groupNames[row!.presentation_group as OfferGroup]}
      description={"مصدر التصنيف: جلسة شبكة محفوظة، صالحة حتى "
        + new Date(row!.valid_until!).toLocaleString("ar-DZ") + ". يمكن للإدارة تحديثها من الشبكة عند الحاجة."}
    /> : !loading && <Alert type={row?.lookup_status === "IN_PROGRESS" ? "info":"warning"} showIcon
      message={row?.lookup_status==="IN_PROGRESS" ? "جلسة استعلام جارية"
        : row?.lookup_status==="UNKNOWN" ? "رد سابق غير كافٍ لتحديد نوع عروض الرقم"
        : "لا يوجد تصنيف موثوق وصالح لهذا الرقم"}
      description="لا نستعمل قائمة عروض رقم آخر، ولا نعتبر تعذّر الاستعلام دليلًا على عدم وجود عروض."
    />}
    {jobUuid && <Space wrap>
      <Tag color={jobStatus==="success"?"green":inProgress(jobStatus||"")?"blue":"orange"}>
        حالة الجلسة: {jobStatus||"قيد الانتظار"}
      </Tag>
      <Typography.Text copyable={{text:jobUuid}} type="secondary" style={{fontSize:11}}>مرجع الجلسة</Typography.Text>
    </Space>}
    <Space wrap>
      <Button size="small" onClick={() => void refresh()} loading={loading}>تحديث التصنيف / نتيجة الجلسة</Button>
      <Button size="small" type={classified ? "default" : "primary"}
        disabled={!stationUuid || sending || Boolean(jobUuid && (!jobStatus || inProgress(jobStatus)))}
        loading={sending}
        onClick={requestDiscovery}>
        {classified ? "استكشاف جديد بإذن الإدارة" : "فتح جلسة لمعرفة العروض"}
      </Button>
    </Space>
    {!stationUuid && <Typography.Text type="secondary" style={{fontSize:12}}>
      الاستكشاف الحي متوقف حتى تصبح شريحة Sama جاهزة. عرض نتائج موثوقة مخزنة لا يحتاج المودم.
    </Typography.Text>}
  </Space>;
}
