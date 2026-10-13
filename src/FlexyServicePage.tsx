import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Button, Card, Col, Empty, Input, InputNumber, Modal, Row,
  Segmented, Select, Space, Spin, Tag, Typography, message
} from "antd";
import { CheckCircleOutlined, PhoneOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { SupabaseClient } from "@supabase/supabase-js";
import SamaOfferDiscoveries from "./SamaOfferDiscoveries";
import CustomerOfferIdentity from "./CustomerOfferIdentity";
import type { OfferGroup, OfferIdentity } from "./CustomerOfferIdentity";

type Offer = {
  offer_uuid: string;
  operator: string;
  family: string;
  group_code: string;
  amount: number;
  display_name: string;
  network_index: string | null;
  details: string | null;
  sort_index: number;
  execution_enabled: boolean;
  execution_available: boolean;
  execution_sim_types: string[] | null;
};
type Station = { station_uuid: string; status: string; computer_name: string | null; last_seen_at: string | null };
type Hardware = {
  sim_uuid: string | null; sim_type: string | null; imsi: string | null; has_pin: boolean;
  sim_last_seen_at: string | null; modem_last_seen_at: string | null;
};
type Job = {
  job_uuid: string; status: string; result_code?: string | null; result_text?: string | null;
};
type QueueResult = { job_uuid: string; status: string; reused: boolean };
type Mode = "offers" | "credit";
type PendingRequest = { fingerprint: string; key: string; job?: Job };
const pendingKey = "flexy_mini_admin_pending_sama_v1";
const readPending = (): PendingRequest | null => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(pendingKey) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as PendingRequest;
    return typeof row.key === "string" && row.key.length > 7 && typeof row.fingerprint === "string"
      ? row : null;
  } catch { return null; }
};
const savePending = (item: PendingRequest | null) => {
  try {
    if (item) window.localStorage.setItem(pendingKey, JSON.stringify(item));
    else window.localStorage.removeItem(pendingKey);
  } catch { /* Best effort; in-memory lock still applies. */ }
};

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("213") && digits.length === 12 ? "0" + digits.slice(3) : digits;
};
const validPhone = (value: string) => /^0[5-7][0-9]{8}$/.test(value);
const fresh = (value: string | null | undefined) =>
  Boolean(value && Number.isFinite(Date.parse(value)) && Date.now() - Date.parse(value) >= 0 && Date.now() - Date.parse(value) < 90_000);
const titleStatus = (status: string) =>
  ({ queued: "في الطابور", claimed: "قيد المعالجة", success: "نجحت", failed: "فشلت", review: "تحتاج مراجعة", unavailable: "غير متاحة" } as Record<string, string>)[status] || status;
const currency = (amount: number) => new Intl.NumberFormat("en-US").format(amount) + " دج";

export default function FlexyServicePage({ db, isCustomer }: { db?: SupabaseClient; isCustomer: boolean }) {
  const [mode, setMode] = useState<Mode>("offers");
  const [identity, setIdentity] = useState<OfferIdentity | null>(null);
  const handleIdentity = useCallback((value: OfferIdentity | null) => {
    setIdentity(value);
    setChosenId(null);
    setFamily("all");
  }, []);
  const [phone, setPhone] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [family, setFamily] = useState<string>("all");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualFamily, setManualFamily] = useState<string | undefined>();
  const [manualAmount, setManualAmount] = useState<number | null>(null);
  const [manualIndex, setManualIndex] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [stationUuid, setStationUuid] = useState<string | null>(null);
  const [stationName, setStationName] = useState("");
  const [stationBusy, setStationBusy] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const initialRequest = useRef<PendingRequest | null>(isCustomer ? null : readPending());
  const [lastJob, setLastJob] = useState<Job | null>(initialRequest.current?.job || null);
  const [jobCheckBusy, setJobCheckBusy] = useState(false);
  const [unknownResult, setUnknownResult] = useState(Boolean(initialRequest.current && !initialRequest.current.job));
  const requestRef = useRef<PendingRequest | null>(initialRequest.current);

  const loadCatalog = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    const { data, error } = await db.rpc("flexy_get_visible_offer_catalog_v2", {
      p_role: isCustomer ? "customer" : "admin"
    });
    setLoading(false);
    if (error) {
      setCatalogError("تعذر جلب كتالوج العروض: " + error.message);
      return;
    }
    setCatalogError("");
    const rows = (Array.isArray(data) ? data : []) as Offer[];
    setOffers(rows.filter(row => row.operator === "mobilis" && row.amount >= 500));
  }, [db, isCustomer]);

  const loadStation = useCallback(async () => {
    if (!db || isCustomer) return;
    setStationBusy(true);
    setStationUuid(null);
    setStationName("");
    const { data, error } = await db.rpc("flexy_mini_station_overview");
    if (error) {
      setStationBusy(false);
      message.warning("لا يمكن فحص Station Connect: " + error.message);
      return;
    }
    const stations = ((Array.isArray(data) ? data : []) as Station[])
      .filter(row => row.status === "approved" && fresh(row.last_seen_at));
    for (const station of stations) {
      const hardware = await db.rpc("station_connect_admin_hardware", {
        p_station_uuid: station.station_uuid
      });
      if (hardware.error) continue;
      const ready = ((Array.isArray(hardware.data) ? hardware.data : []) as Hardware[])
        .some(sim => sim.sim_type === "mobilis-sama"
          && sim.imsi?.startsWith("60301")
          && sim.has_pin
          && fresh(sim.sim_last_seen_at)
          && fresh(sim.modem_last_seen_at));
      if (ready) {
        setStationUuid(station.station_uuid);
        setStationName(station.computer_name || "Station Connect");
        break;
      }
    }
    setStationBusy(false);
  }, [db, isCustomer]);

  useEffect(() => { void loadCatalog(); void loadStation(); }, [loadCatalog, loadStation]);

  const verifiedGroup: OfferGroup | null = identity?.phone === normalizePhone(phone)
    && Date.parse(identity.validUntil) > Date.now() ? identity.group : null;
  const compatibleGroup = (offer: Offer, group: OfferGroup | null): boolean => {
    if (!group) return false;
    if (group === "SAMA") return ["sama mix","sama talk","sama net"].includes(offer.family.toLowerCase());
    if (group === "PIXX") return offer.family.toLowerCase() === "pixx";
    return offer.family.toLowerCase() === "revolution";
  };
  const eligibleOffers = offers.filter(row => compatibleGroup(row, verifiedGroup));
  const families = [...new Set(eligibleOffers.map(row => row.family))];
  const visibleOffers = eligibleOffers.filter(row => family === "all" || row.family === family)
    .sort((a,b) => a.amount-b.amount || a.family.localeCompare(b.family));
  const chosen = eligibleOffers.find(row => row.offer_uuid === chosenId) || null;
  const samaRoute = Boolean(verifiedGroup && chosen?.execution_enabled && chosen?.execution_available
    && chosen?.execution_sim_types?.includes("mobilis-sama")
    && chosen?.network_index);

  const chooseManual = () => {
    if (!manualFamily || !manualAmount) {
      message.warning("حدد عائلة العرض ومبلغه أولًا");
      return;
    }
    const match = eligibleOffers.find(row => row.family === manualFamily
      && row.amount === manualAmount
      && (!manualIndex.trim() || row.network_index === manualIndex.trim()));
    if (!match) {
      message.warning("العرض غير موجود في الكتالوج المعتمد. لا يمكن إرسال رقم USSD غير مسجل.");
      return;
    }
    setFamily(match.family);
    setChosenId(match.offer_uuid);
    message.success("تم مطابقة العرض مع الكتالوج المعتمد");
  };

  const checkJob = async () => {
    if (!db || !lastJob) return;
    setJobCheckBusy(true);
    const { data, error } = await db.rpc("station_connect_admin_offer_execute_job", {
      p_job_uuid: lastJob.job_uuid
    });
    setJobCheckBusy(false);
    if (error) {
      message.error("تعذر التحقق من النتيجة: " + error.message);
      return;
    }
    const result = (Array.isArray(data) ? data[0] : data) as Job | null;
    if (result) {
      setLastJob(result);
      setUnknownResult(false);
      if (requestRef.current) {
        requestRef.current = { ...requestRef.current, job: result };
        savePending(requestRef.current);
      }
    }
  };

  const submit = () => {
    const target = normalizePhone(phone);
    if (!validPhone(target)) { message.warning("اكتب رقم هاتف صحيحًا دون فراغات"); return; }
    if (!verifiedGroup || !identity || !chosen || !samaRoute) { message.warning("يجب التحقق من مجموعة عروض هذا الرقم أولًا، ثم اختيار عرض منها"); return; }
    if (isCustomer) { message.warning("شحن الزبون متوقف حتى تفعيل محفظته ومسار الطلبات"); return; }
    if (!stationUuid) { message.warning("Sama غير جاهزة. افحص الشريحة في المحطات والشرائح."); return; }
    if (!db || sendBusy || lastJob) return;

    const fingerprint = [target, chosen.offer_uuid, stationUuid].join(":");
    if (requestRef.current && requestRef.current.fingerprint !== fingerprint) {
      message.warning("يوجد طلب غير محسوم. تحقق منه قبل إنشاء طلب مختلف.");
      return;
    }
    Modal.confirm({
      title: "تأكيد إرسال عرض Sama",
      content: "الرقم: " + target + " — العرض: " + chosen.display_name + " (" + currency(chosen.amount)
        + "). هذه عملية شبكة حقيقية وقد تُخصم من رصيد شريحة Sama. لن يُرسل الأمر إلا بعد موافقتك.",
      okText: "أؤكد الإرسال",
      cancelText: "إلغاء",
      okButtonProps: { danger: true },
      onOk: async () => {
        setSendBusy(true);
        const verification = await db.rpc("flexy_mini_admin_customer_offer_identity", {p_phone: target});
        const verified = (Array.isArray(verification.data) ? verification.data[0] : verification.data) as
          {lookup_status:string;presentation_group:string|null;discovery_uuid:string|null;valid_until:string|null}|null;
        if (verification.error || verified?.lookup_status !== "CLASSIFIED"
          || verified.presentation_group !== verifiedGroup
          || verified.discovery_uuid !== identity.discoveryUuid
          || !verified.valid_until || Date.parse(verified.valid_until) <= Date.now()) {
          setSendBusy(false);
          message.error("تعذر تأكيد نوع عروض الزبون من السيرفر. أعد التحقق دون تنفيذ شحن.");
          return;
        }
        const request = requestRef.current || { fingerprint, key: crypto.randomUUID() };
        requestRef.current = request;
        savePending(request);
        try {
          const { data, error } = await db.rpc("station_connect_admin_create_offer_execute_v2", {
            p_phone: target,
            p_family: chosen.family,
            p_network_index: chosen.network_index,
            p_amount: chosen.amount,
            p_idempotency_key: request.key,
            p_station_uuid: stationUuid
          });
          if (error) {
            setUnknownResult(true);
            message.error("السيرفر لم يؤكد إنشاء الطلب. لن ننشئ مفتاح طلب جديدًا تلقائيًا: " + error.message);
            return;
          }
          const result = (Array.isArray(data) ? data[0] : data) as QueueResult | null;
          if (!result?.job_uuid) {
            setUnknownResult(true);
            message.warning("نتيجة غير مؤكدة. تجنب إرسال طلب جديد قبل المراجعة.");
            return;
          }
          const job = { job_uuid: result.job_uuid, status: result.status };
          setLastJob(job);
          requestRef.current = { ...request, job };
          savePending(requestRef.current);
          setUnknownResult(false);
          message.success(result.reused ? "طلب موجود مسبقًا، لم يُكرر" : "تم إرسال الطلب إلى Station Connect");
        } catch {
          setUnknownResult(true);
          message.error("انقطع الاتصال. قد تكون العملية أُرسلت؛ لا تكررها.");
        } finally {
          setSendBusy(false);
        }
      }
    });
  };

  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <Card>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap>
          <Tag color="green">Mobilis</Tag>
          <Tag>Sama — عروض</Tag>
          {!isCustomer && <Tag color={stationUuid ? "green" : "orange"}>
            {stationBusy ? "جاري فحص المحطة" : stationUuid ? "Sama مرصودة" : "Sama غير جاهزة"}
          </Tag>}
        </Space>
        <Typography.Text strong>رقم هاتف الزبون</Typography.Text>
        <Input
          size="large" dir="ltr" inputMode="tel" autoComplete="tel"
          aria-label="رقم الهاتف المراد شحنه"
          placeholder="0XXXXXXXXX" value={phone}
          maxLength={20}
          prefix={<PhoneOutlined />}
          onChange={event => setPhone(event.target.value)}
        />
        <Segmented
          block
          size="large"
          options={[{ label: "عروض", value: "offers" }, { label: "رصيد عادي", value: "credit" }]}
          value={mode}
          onChange={value => setMode(value as Mode)}
        />
      </Space>
    </Card>

    {mode === "credit" ? <Card title="رصيد عادي">
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Alert showIcon type="warning" message="الرصيد العادي غير متاح عبر Sama حاليًا"
          description="سنعرض الرصيد العادي هنا عند ربط شريحة Arsselli أو مسار تنفيذ آخر معتمد. لن نحول الطلب إلى شحن عروض بالخطأ." />
        <Space wrap>{[100, 200, 500].map(value =>
          <Button key={value} type={amount === value ? "primary" : "default"}
            onClick={() => setAmount(value)}>{currency(value)}</Button>)}</Space>
        <InputNumber<number> min={1} max={100000} precision={0} value={amount}
          onChange={setAmount} style={{ width: "100%" }} size="large" placeholder="المبلغ" addonAfter="دج" />
        <Button block size="large" type="primary" disabled>إرسال الرصيد — غير مفعّل</Button>
      </Space>
    </Card> : <>
      <Card title="معرفة نوع عروض الزبون">
        <CustomerOfferIdentity db={db} phone={phone} stationUuid={stationUuid}
          isCustomer={isCustomer} onIdentity={handleIdentity}/>
      </Card>
      <Card title="العروض" extra={<Button size="small" icon={<ReloadOutlined/>}
        onClick={() => void loadCatalog()} loading={loading}>تحديث</Button>}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {catalogError && <Alert type="error" showIcon message={catalogError}/>}
          {!verifiedGroup && <Alert type="info" showIcon
            message="العروض تظهر بعد التحقق من نوع الرقم"
            description="نقرأ تصنيف الرقم المحفوظ إن كان صالحًا، أو نفتح استعلام Sama عند طلب الإدارة. لا نعرض PixX وRevolution وSama معًا دون دليل."/>}
          {verifiedGroup && <Tag color="green">مجموعة عروض الرقم: {verifiedGroup==="SAMA"?"Sama":verifiedGroup==="PIXX"?"PixX":"Revolution"}</Tag>}
          <Select
            aria-label="عائلة عروض موبيليس"
            style={{ width: "100%" }}
            size="large"
            value={family}
            onChange={setFamily}
            options={[{ value:"all", label:"جميع العروض" }, ...families.map(value => ({ value, label:value }))]}
          />
          {loading ? <Spin/> : visibleOffers.length === 0
            ? <Empty description={!verifiedGroup
                ? "لم يتم التحقق من مجموعة عروض هذا الرقم بعد"
                : isCustomer ? "لا توجد عروض منشورة لهذا الحساب حاليًا"
                : "لا توجد عروض متاحة لهذه المجموعة في الكتالوج"} />
            : <Row gutter={[10, 10]}>
              {visibleOffers.map(offer => <Col xs={12} sm={8} lg={6} key={offer.offer_uuid}>
                <Button block size="large" type={chosenId === offer.offer_uuid ? "primary" : "default"}
                  onClick={() => setChosenId(offer.offer_uuid)}
                  style={{ height:"auto", minHeight:76, whiteSpace:"normal", padding:"10px 6px" }}>
                  <Space direction="vertical" size={2} style={{width:"100%"}}>
                    <Typography.Text style={{ color:chosenId===offer.offer_uuid?"white":undefined, fontSize:12 }}>
                      {offer.family}
                    </Typography.Text>
                    <Typography.Text strong style={{ color:chosenId===offer.offer_uuid?"white":undefined }}>
                      {currency(offer.amount)}
                    </Typography.Text>
                  </Space>
                </Button>
              </Col>)}
            </Row>}
          {!isCustomer && <Button type="link" icon={<SearchOutlined/>}
            disabled={!verifiedGroup} onClick={() => setManual(value => !value)}>
            {manual ? "إغلاق الإدخال اليدوي" : "اختيار عرض يدويًا من الكتالوج"}
          </Button>}
          {!isCustomer && manual && <Card size="small" title="إدخال رقم عرض معروف">
            <Space direction="vertical" style={{width:"100%"}}>
              <Select placeholder="عائلة العرض" value={manualFamily} onChange={setManualFamily}
                options={families.map(value => ({label:value,value}))} style={{width:"100%"}}/>
              <InputNumber<number> style={{width:"100%"}} min={500} max={100000} precision={0}
                placeholder="قيمة العرض دج" value={manualAmount} onChange={setManualAmount}/>
              <Input dir="ltr" inputMode="numeric" maxLength={4}
                placeholder="رقم خيار الشبكة (اختياري)" value={manualIndex}
                onChange={event => setManualIndex(event.target.value.replace(/[^0-9]/g,""))}/>
              <Button block onClick={chooseManual}>مطابقة العرض</Button>
              <Typography.Text type="secondary" style={{fontSize:12}}>
                الإدخال اليدوي يختار عرضًا مسجلًا ولا يرسل كودًا مجهولًا للشبكة.
              </Typography.Text>
            </Space>
          </Card>}
        </Space>
      </Card>

      <Card title="تأكيد الطلب">
        <Space direction="vertical" size="middle" style={{width:"100%"}}>
          {chosen ? <Space wrap>
            <Tag color="blue">{chosen.display_name}</Tag>
            <Tag>{currency(chosen.amount)}</Tag>
            {samaRoute ? <Tag color="green"><CheckCircleOutlined/> مسار Sama مسجل</Tag>
              : <Tag color="orange">التنفيذ غير معتمد لهذا العرض</Tag>}
          </Space> : <Typography.Text type="secondary">اختر العرض من الأعلى.</Typography.Text>}
          {isCustomer
            ? <Alert type="info" showIcon message="طلبات الزبائن لم تُربط بالمحفظة بعد"
                description="نفس صفحة الفليكسي للجميع، لكن الإرسال لا يُفعّل لحساب الزبون قبل فحص الصلاحيات والرصيد من الخادم."/>
            : !stationUuid
              ? <Alert showIcon type="warning" message="لا توجد شريحة Sama جاهزة"
                  description="التجهيز يتم في «المحطات والشرائح». ظهور محطة متصلة وحده لا يكفي لإرسال USSD." />
              : <Typography.Text type="secondary">محطة التنفيذ: {stationName}. يختار السيرفر المسار المعتمد ويتحقق من PIN والرصيد قبل التنفيذ.</Typography.Text>}
          {lastJob && <Alert showIcon type={lastJob.status==="success"?"success":"info"}
            message={"العملية: "+titleStatus(lastJob.status)}
            description={<Space direction="vertical" size={4}>
              <Typography.Text copyable={{text:lastJob.job_uuid}}>مرجع العملية: {lastJob.job_uuid}</Typography.Text>
              {lastJob.result_code&&<Typography.Text>رمز النتيجة: {lastJob.result_code}</Typography.Text>}
              <Button size="small" loading={jobCheckBusy} onClick={() => void checkJob()}>تحديث حالة العملية</Button>
              {lastJob.status!=="queued"&&lastJob.status!=="claimed"&&<Button size="small"
                onClick={() => {setLastJob(null);requestRef.current=null;savePending(null);setUnknownResult(false);}}>
                طلب جديد بعد مراجعة النتيجة
              </Button>}
            </Space>}
          />}
          {unknownResult && !lastJob && <Alert type="error" showIcon
            message="حالة الطلب غير مؤكدة"
            description="لا تغيّر الرقم أو العرض ولا تبدأ طلبًا جديدًا حتى تتأكد من العمليات. سيُستخدم نفس مفتاح العملية عند إعادة المحاولة."/>}
          <Button type="primary" size="large" block loading={sendBusy}
            disabled={isCustomer||!db||!stationUuid||!samaRoute||!validPhone(normalizePhone(phone))||Boolean(lastJob)}
            onClick={submit}>إرسال العرض</Button>
          <Typography.Text type="secondary" style={{fontSize:12}}>
            لا تُرسل أي عملية بمجرد اختيار العرض. الإرسال الفعلي يتطلب تأكيدًا صريحًا، وموافقة السيرفر.
          </Typography.Text>
        </Space>
      </Card>
    </>}

    {!isCustomer && <Card size="small">
      <Space direction="vertical" style={{width:"100%"}}>
        <Button type="default" block onClick={() => setShowDiscovery(value => !value)}>
          {showDiscovery ? "إغلاق أداة اكتشاف Sama" : "أداة الإدارة: اكتشاف عروض Sama عبر USSD"}
        </Button>
        {showDiscovery && db && <SamaOfferDiscoveries db={db} stationUuid={stationUuid}
          samaReady={Boolean(stationUuid)}/>}
      </Space>
    </Card>}
  </Space>;
}
