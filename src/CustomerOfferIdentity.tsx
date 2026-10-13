import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Space, Tag, Typography, message } from "antd";
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
  db, phone, stationUuid, isCustomer, onIdentity, active, requestToken, onJobChange,
}: {
  onJobChange?: () => void;
  active: boolean;
  requestToken: number;
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
  const currentPhone = useRef(normalized);
  currentPhone.current = normalized;
  const reading = useRef(false);
  const dispatching = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const check = useCallback(async (suggestDiscovery = false) => {
    if (reading.current) return;
    const seq = requestSequence.current;
    const isCurrent = () => seq === requestSequence.current && currentPhone.current === normalized;
    if (!db || !isPhone(normalized) || isCustomer) {
      setRow(null);
      onIdentity(null);
      return;
    }
    reading.current = true;
    setLoading(true);
    try {
    const result = await db.rpc("flexy_mini_admin_customer_offer_identity", {
      p_phone: normalized,
    });
    if (!isCurrent()) return;
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
      setJobStatus(previous => value.active_job_uuid === jobUuid && previous ? previous : "claimed");
      setUncertain(false); setConfirming(false);
    }
    if (value?.lookup_status === "CLASSIFIED"
      && groups.includes(value.presentation_group as OfferGroup)
      && value.discovery_uuid && value.discovered_at && value.valid_until
      && Date.parse(value.valid_until) > Date.now()) {
      setConfirming(false);
      onIdentity({
        phone: normalized,
        group: value.presentation_group as OfferGroup,
        discoveryUuid: value.discovery_uuid,
        discoveredAt: value.discovered_at,
        validUntil: value.valid_until,
      });
    } else {
      onIdentity(null);
      if (suggestDiscovery && !value?.active_job_uuid && stationUuid && !uncertain)
        setConfirming(true);
    }
    } catch {
      if (isCurrent()) {
        setRow(null); onIdentity(null);
        setError("تعذر معرفة عروض الرقم، يرجى المحاولة بعد حين.");
      }
    } finally {
      if (isCurrent()) { reading.current = false; setLoading(false); }
    }
  }, [db, normalized, isCustomer, onIdentity, stationUuid, uncertain, jobUuid]);

  useEffect(() => {
    requestSequence.current++;
    reading.current = false; dispatching.current = false;
    setRow(null); setJobUuid(null); setJobStatus(null);
    setNetworkError(""); setError(""); setConfirming(false); setUncertain(false);
    setLoading(false); setSending(false); onIdentity(null);
    return () => { requestSequence.current++; };
  }, [normalized, isCustomer, db, onIdentity]);

  // Opening Offers is the intent to inspect this number. Typing or page entry sends no USSD.
  useEffect(() => {
    if (active && isPhone(normalized) && !isCustomer && db) void check(true);
    // check changes when job/readiness changes; those must not reopen a dismissed confirmation.
  }, [active, requestToken, normalized, isCustomer, db]);

  const refresh = async () => {
    if (!db || !isPhone(normalized) || reading.current) return;
    const seq = requestSequence.current;
    const isCurrent = () => seq === requestSequence.current && currentPhone.current === normalized;
    setNetworkError("");
    if (jobUuid && (!jobStatus || inProgress(jobStatus))) {
      reading.current = true; setLoading(true);
      try {
      const result = await db.rpc("station_connect_admin_offer_discovery_job", {
        p_job_uuid: jobUuid,
      });
      if (!isCurrent()) return;
      if (result.error) {
        setError("تعذر قراءة الجلسة: " + result.error.message);
        return;
      }
      const job = (Array.isArray(result.data) ? result.data[0] : result.data) as DiscoveryJob | null;
      if (!job || job.job_uuid !== jobUuid) {
        setError("جلسة الاستكشاف غير موجودة. لا نعيد المحاولة تلقائيًا.");
        return;
      }
      setJobStatus(job.status);
      if (!inProgress(job.status)) onJobChange?.();
      if (inProgress(job.status)) {
        return;
      }
      if (job.status !== "success") {
        setNetworkError("لم يكتمل استعلام الشبكة (" + (job.result_code || job.status)
          + "). لا نستنتج أن الزبون بلا عروض، ولا نكرر الاستعلام تلقائيًا.");
      }
      } catch {
        if (isCurrent()) setError("تعذر متابعة الاستعلام. لن نفتح جلسة أخرى تلقائيًا.");
        return;
      } finally {
        if (isCurrent()) { reading.current = false; setLoading(false); }
      }
    }
    if (isCurrent()) await check();
  };
  refreshRef.current = refresh;
  useEffect(() => {
    if (!active || !jobUuid || !inProgress(jobStatus || "")) return;
    let polls = 0;
    const timer = window.setInterval(() => {
      if (++polls > 60) { window.clearInterval(timer); return; }
      void refreshRef.current();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [active, jobUuid, jobStatus]);

  const requestDiscovery = () => {
    if (!db || isCustomer || !isPhone(normalized) || sending || dispatching.current || uncertain || reading.current) return;
    if (jobUuid && (!jobStatus || inProgress(jobStatus))) {
      message.warning("توجد جلسة استكشاف جارية. حدّث نتيجتها أولًا.");
      return;
    }
    if (!stationUuid) {
      message.warning("شريحة Mobilis Sama غير جاهزة؛ جهزها في «المحطات والشرائح» أولًا.");
      return;
    }
    setConfirming(true);
  };
  const confirmDiscovery = async () => {
    if (!db || isCustomer || !stationUuid || !isPhone(normalized) || !confirming
      || dispatching.current || uncertain || reading.current
      || Boolean(jobUuid && (!jobStatus || inProgress(jobStatus)))) return;
    const seq = requestSequence.current;
    const isCurrent = () => seq === requestSequence.current && currentPhone.current === normalized;
    dispatching.current = true; setConfirming(false);
        setSending(true);
        setNetworkError("");
        setError("");
        try {
          const result = await db.rpc("station_connect_admin_create_offer_discovery", {
            p_phone: normalized,
            p_station_uuid: stationUuid,
          });
          if (!isCurrent()) return;
          if (result.error) {
            setUncertain(true);
            setError("تعذر تأكيد فتح الجلسة؛ حدّث الحالة قبل أي طلب آخر: " + result.error.message);
            return;
          }
          const queued = (Array.isArray(result.data) ? result.data[0] : result.data) as Queued | null;
          if (!queued?.job_uuid) {
            setUncertain(true);
            setError("السيرفر لم يرجع رقم جلسة. لا تعاود الاستعلام قبل التحقق.");
            return;
          }
          setJobUuid(queued.job_uuid);
          setJobStatus(queued.status); onJobChange?.();
          message.info(queued.reused ? "جلسة سابقة ما زالت جارية؛ لم نكررها" : "تم فتح جلسة استعلام واحدة");
          await check();
        } catch {
          if (isCurrent()) {
            setUncertain(true);
            setError("انقطع الاتصال؛ قد تكون الجلسة بدأت. حدّث الحالة ولا ترسل طلبًا ثانيًا قبل التحقق.");
          }
        } finally {
          if (isCurrent()) { dispatching.current = false; setSending(false); }
        }
  };

  if (!isPhone(normalized)) {
    return <Typography.Text type="secondary">رقم غير مكتمل</Typography.Text>;
  }
  if (isCustomer) {
    return <Typography.Text type="secondary">استكشاف عروض الزبائن غير مفعّل</Typography.Text>;
  }

  const classified = row?.lookup_status === "CLASSIFIED" && groups.includes(row.presentation_group as OfferGroup)
    && Boolean(row.valid_until && Date.parse(row.valid_until) > Date.now());
  return <Space direction="vertical" size="small" style={{ width:"100%" }}>
    {error && <Alert showIcon type="error" message={error} />}
    {networkError && <Alert showIcon type="warning" message={networkError} />}
    {loading && <Typography.Text type="secondary">جاري معرفة عروض الرقم...</Typography.Text>}
    {classified ? <Tag color="green">{groupNames[row!.presentation_group as OfferGroup]}</Tag>
      : !loading && <Typography.Text type="secondary">
          {row?.lookup_status==="IN_PROGRESS" ? "بانتظار نتيجة المحطة"
            : row?.lookup_status==="UNKNOWN" ? "نوع العروض غير محسوم" : "لم يُكتشف نوع العروض"}
        </Typography.Text>}
    {confirming && <Card size="small" title="معرفة عروض الرقم">
      <Space direction="vertical" style={{width:"100%"}}>
        <Typography.Text>استعلام عروض <bdi dir="ltr">{normalized}</bdi></Typography.Text>
        <Space wrap>
          <Button type="primary" loading={sending} onClick={() => void confirmDiscovery()}>تأكيد الاستعلام</Button>
          <Button onClick={() => setConfirming(false)}>إلغاء</Button>
        </Space>
      </Space>
    </Card>}
    {jobUuid && <Space wrap>
      <Tag color={jobStatus==="success"?"green":inProgress(jobStatus||"")?"blue":"orange"}>
        حالة الجلسة: {jobStatus||"قيد الانتظار"}
      </Tag>
      <Typography.Text copyable={{text:jobUuid}} type="secondary" style={{fontSize:11}}>مرجع الجلسة</Typography.Text>
    </Space>}
    <Space wrap>
      <Button size="small" onClick={() => void refresh()} loading={loading}>تحديث النتيجة</Button>
      <Button size="small" type={classified ? "default" : "primary"}
        disabled={!stationUuid || sending || loading || uncertain || Boolean(jobUuid && (!jobStatus || inProgress(jobStatus)))}
        loading={sending}
        onClick={requestDiscovery}>
        {classified ? "استكشاف جديد" : "استكشاف العروض"}
      </Button>
    </Space>
    {!stationUuid && <Typography.Text type="secondary" style={{fontSize:12}}>
      Sama غير جاهزة للاستكشاف
    </Typography.Text>}
  </Space>;
}
