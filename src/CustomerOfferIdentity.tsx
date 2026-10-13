import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Space, Tag, Typography, message } from "antd";
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
  const [uncertain, setUncertain] = useState(false);
  const currentStation = useRef(stationUuid);
  currentStation.current = stationUuid;
  // One network lookup per explicit Offers action. Cache reads and refreshes never dispatch a second job.
  const autoDiscoveryIntent = useRef<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  // Only the explicit Offers action may lead here, after its cached identity lookup.
  // This is a non-financial offer discovery; it never selects or sends a paid offer.
  const startDiscovery = useCallback(async () => {
    const station = currentStation.current;
    if (!db || isCustomer || !isPhone(normalized) || !station
      || dispatching.current || uncertain) return;
    const seq = requestSequence.current;
    const isCurrent = () => seq === requestSequence.current && currentPhone.current === normalized;
    dispatching.current = true;
    setSending(true);
    setNetworkError("");
    setError("");
    try {
      const result = await db.rpc("station_connect_admin_create_offer_discovery", {
        p_phone: normalized,
        p_station_uuid: station,
      });
      if (!isCurrent()) return;
      if (result.error) {
        setUncertain(true);
        setError("تعذر تأكيد فتح جلسة الاستعلام؛ حدّث الحالة قبل إعادة المحاولة: " + result.error.message);
        return;
      }
      const queued = (Array.isArray(result.data) ? result.data[0] : result.data) as Queued | null;
      if (!queued?.job_uuid) {
        setUncertain(true);
        setError("لم يرجع السيرفر مرجع الاستعلام. حدّث الحالة ولا تكرر الطلب.");
        return;
      }
      setJobUuid(queued.job_uuid);
      setJobStatus(queued.status);
      onJobChange?.();
      message.info(queued.reused ? "استعلام جارٍ مسبقًا؛ لم نكرره" : "جاري استعلام عروض الرقم من الشبكة");
      if (queued.status === "success") void refreshRef.current();
    } catch {
      if (isCurrent()) {
        setUncertain(true);
        setError("انقطع الاتصال وقد تكون جلسة الاستعلام بدأت. حدّث الحالة قبل المحاولة مجددًا.");
      }
    } finally {
      if (isCurrent()) { dispatching.current = false; setSending(false); }
    }
  }, [db, normalized, isCustomer, onJobChange, uncertain]);

  const check = useCallback(async (suggestDiscovery = false) => {
    if (reading.current) return;
    let startAutomatically = false;
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
      setUncertain(false);
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
      const intent = normalized + "|" + requestToken;
      if (suggestDiscovery && !value?.active_job_uuid && value?.lookup_status !== "IN_PROGRESS"
        && currentStation.current && !uncertain && !dispatching.current && !jobUuid
        && autoDiscoveryIntent.current !== intent) {
        autoDiscoveryIntent.current = intent;
        startAutomatically = true;
      }
    }
    } catch {
      if (isCurrent()) {
        setRow(null); onIdentity(null);
        setError("تعذر معرفة عروض الرقم، يرجى المحاولة بعد حين.");
      }
    } finally {
      if (isCurrent()) {
        reading.current = false;
        setLoading(false);
        if (startAutomatically) void startDiscovery();
      }
    }
  }, [db, normalized, isCustomer, onIdentity, uncertain, jobUuid, requestToken, startDiscovery]);

  useEffect(() => {
    requestSequence.current++;
    reading.current = false; dispatching.current = false;
    setRow(null); setJobUuid(null); setJobStatus(null);
    setNetworkError(""); setError(""); setUncertain(false);
    autoDiscoveryIntent.current = null;
    setLoading(false); setSending(false); onIdentity(null);
    return () => { requestSequence.current++; };
  }, [normalized, isCustomer, db, onIdentity]);

  // Clicking Offers reads the stored identity, then starts ONE discovery if necessary.
  // Typing, refresh and opening the Flexy page do not start network sessions.
  useEffect(() => {
    if (active && isPhone(normalized) && !isCustomer && db) void check(true);
    // Use action token + active, not check callback, to prevent extra dispatch on rerenders.
  }, [active, requestToken, normalized, isCustomer, db, stationUuid]);

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
        setNetworkError("لم يكتمل الاستعلام: " + (job.result_code || job.status));
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
    {jobUuid && <Space wrap>
      <Tag color={jobStatus==="success"?"green":inProgress(jobStatus||"")?"blue":"orange"}>
        حالة الجلسة: {jobStatus||"قيد الانتظار"}
      </Tag>
      <Typography.Text copyable={{text:jobUuid}} type="secondary" style={{fontSize:11}}>مرجع الجلسة</Typography.Text>
    </Space>}
    {(Boolean(jobUuid) || uncertain || Boolean(error) || Boolean(networkError)) && <Button
      size="small" onClick={() => void refresh()} loading={loading || sending}>
      تحديث الحالة
    </Button>}
    {sending && <Typography.Text type="secondary">جاري فتح استعلام الشبكة...</Typography.Text>}
    {!stationUuid && <Typography.Text type="secondary" style={{fontSize:12}}>
      Sama غير جاهزة للاستكشاف
    </Typography.Text>}
  </Space>;
}
