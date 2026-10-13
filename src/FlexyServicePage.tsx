import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Button, Card, Col, Empty, Input, InputNumber, Modal, Row,
  Segmented, Select, Space, Spin, Tag, Typography, message
} from "antd";
import { CheckCircleOutlined, PhoneOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { SupabaseClient } from "@supabase/supabase-js";
import FlexyOperationHistory from "./FlexyOperationHistory";
import CustomerOfferIdentity from "./CustomerOfferIdentity";
import type { OfferGroup, OfferIdentity } from "./CustomerOfferIdentity";
import {readSamaStatus,readinessProblems} from "./SamaOperationalActions";
import type {SamaStatus} from "./SamaOperationalActions";

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
type Job = {
  job_uuid: string; status: string; result_code?: string | null; result_text?: string | null;
};
type QueueResult = { job_uuid: string; status: string; reused: boolean };
type EligibleRoute = {
  route_uuid: string; sim_uuid: string; sim_type: string; source_label: string;
  operational_balance: number; required_balance: number; priority: number;
};
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
const titleStatus = (status: string) =>
  ({ queued: "في الطابور", claimed: "قيد المعالجة", success: "نجحت", failed: "فشلت", review: "تحتاج مراجعة", unavailable: "غير متاحة" } as Record<string, string>)[status] || status;
const currency = (amount: number) => new Intl.NumberFormat("en-US").format(amount) + " دج";

export default function FlexyServicePage({ db, isCustomer, onOpenStations }: { db?: SupabaseClient; isCustomer: boolean; onOpenStations?: () => void }) {
  const [mode, setMode] = useState<Mode>("credit");
  const [offersRequest, setOffersRequest] = useState(0);
  const [confirmSend, setConfirmSend] = useState(false);
  const sendLock = useRef(false);
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
  const [samaStatus, setSamaStatus] = useState<SamaStatus | null>(null);
  const [executePrerequisitesReady, setExecutePrerequisitesReady] = useState(false);
  const [stationError, setStationError] = useState("");
  const [routeChoice, setRouteChoice] = useState<EligibleRoute | null>(null);
  const [routeCheckBusy, setRouteCheckBusy] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [routeRefreshToken, setRouteRefreshToken] = useState(0);
  const routeCheckSequence = useRef(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const refreshHistory = useCallback(() => setHistoryRefresh(value => value + 1), []);
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
    setExecutePrerequisitesReady(false);
    try {
      const rows=await readSamaStatus(db);
      const status=rows.find(row=>row.execute_prerequisites_ready)||rows.find(row=>row.discover_ready)||rows[0]||null;
      setSamaStatus(status);
      setStationError("");
      if(status?.discover_ready){
        setStationUuid(status.station_uuid);
        setStationName(status.station_name||"Station Connect");
        setExecutePrerequisitesReady(status.execute_prerequisites_ready);
      }
    } catch(cause) {
      setStationError("تعذر فحص جاهزية Sama: "+(cause instanceof Error?cause.message:String(cause)));
      setSamaStatus(null);
    } finally {
      setStationBusy(false);
    }
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
  const familyOrder = ["Sama Mix", "Sama Talk", "Sama Net"];
  const visibleOffers = eligibleOffers.filter(row => family === "all" || row.family === family)
    .sort((a,b) => {
      const ia = familyOrder.indexOf(a.family), ib = familyOrder.indexOf(b.family);
      if (ia !== ib && (ia >= 0 || ib >= 0)) return (ia < 0 ? 99 : ia)-(ib < 0 ? 99 : ib);
      return a.family === b.family ? a.amount-b.amount : a.family.localeCompare(b.family);
    });
  const chosen = eligibleOffers.find(row => row.offer_uuid === chosenId) || null;
  const samaRoute = Boolean(verifiedGroup && chosen?.execution_enabled && chosen?.execution_available
    && chosen?.execution_sim_types?.includes("mobilis-sama")
    && chosen?.network_index);

  // The shared Router, not the page, selects the highest-priority eligible route.
  // An Arsselli offer route is never treated as ordinary-credit execution.
  useEffect(() => {
    const sequence = ++routeCheckSequence.current;
    setRouteChoice(null);
    setRouteError("");
    if (!db || isCustomer || !chosen || !verifiedGroup || mode !== "offers") {
      setRouteCheckBusy(false);
      return;
    }
    setRouteCheckBusy(true);
    void Promise.resolve(db.rpc("station_connect_admin_offer_route_preview", {
      p_family: chosen.family,
      p_amount: chosen.amount,
      p_station_uuid: null
    })).then(({data,error}) => {
      if (sequence !== routeCheckSequence.current) return;
      setRouteCheckBusy(false);
      if (error) {
        setRouteError("تعذر فحص مسارات الإرسال: " + error.message);
        return;
      }
      const candidate = (Array.isArray(data) ? data[0] : data) as EligibleRoute | null;
      setRouteChoice(candidate || null);
    }).catch(() => {
      if (sequence !== routeCheckSequence.current) return;
      setRouteCheckBusy(false);
      setRouteError("تعذر الاتصال بفحص مصدر التنفيذ.");
    });
    return () => { routeCheckSequence.current++; };
  }, [db, isCustomer, chosen?.offer_uuid, verifiedGroup, mode, routeRefreshToken]);

  const routeCanSendThroughSama = Boolean(samaRoute && stationUuid && executePrerequisitesReady
    && !routeCheckBusy && !routeError
    && routeChoice?.sim_type === "mobilis-sama" && routeChoice.sim_uuid === samaStatus?.sim_uuid);

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
      setLastJob(result); refreshHistory();
      setUnknownResult(false);
      if (requestRef.current) {
        requestRef.current = { ...requestRef.current, job: result };
        savePending(requestRef.current);
      }
    }
  };

  const submit = (confirmed = false) => {
    const target = normalizePhone(phone);
    if (!validPhone(target)) { message.warning("اكتب رقم هاتف صحيحًا دون فراغات"); return; }
    if (!verifiedGroup || !identity || !chosen || !samaRoute) { message.warning("يجب التحقق من مجموعة عروض هذا الرقم أولًا، ثم اختيار عرض منها"); return; }
    if (isCustomer) { message.warning("شحن الزبون متوقف حتى تفعيل محفظته ومسار الطلبات"); return; }
    if (!routeCanSendThroughSama) {
      message.warning("الخدمة غير متاحة حاليًا، يرجى المحاولة بعد حين."); return;
    }
    if (!db || sendBusy || sendLock.current || lastJob) return;

    const fingerprint = [target, chosen.offer_uuid, stationUuid].join(":");
    if (requestRef.current && requestRef.current.fingerprint !== fingerprint) {
      message.warning("يوجد طلب غير محسوم. تحقق منه قبل إنشاء طلب مختلف.");
      return;
    }
    if (!confirmed) { setConfirmSend(true); return; }
    setConfirmSend(false);
    sendLock.current = true;
    void (async () => {
      setSendBusy(true);
      let verification;
      try {
        verification = await db.rpc("flexy_mini_admin_customer_offer_identity", {p_phone: target});
      } catch {
        setSendBusy(false); sendLock.current = false;
        message.error("تعذر الاتصال للتحقق من نوع العرض؛ لم يتم إرسال عملية.");
        return;
      }
      const verified = (Array.isArray(verification.data) ? verification.data[0] : verification.data) as
        {lookup_status:string;presentation_group:string|null;discovery_uuid:string|null;valid_until:string|null}|null;
      if (verification.error || verified?.lookup_status !== "CLASSIFIED"
        || verified.presentation_group !== verifiedGroup
        || verified.discovery_uuid !== identity.discoveryUuid
        || !verified.valid_until || Date.parse(verified.valid_until) <= Date.now()) {
        setSendBusy(false); sendLock.current = false;
        message.error("تعذر تأكيد نوع عروض الزبون من السيرفر. أعد التحقق دون تنفيذ شحن.");
        return;
      }
      const request = requestRef.current || { fingerprint, key: crypto.randomUUID() };
      requestRef.current = request;
      savePending(request);
      try {
        const { data, error } = await db.rpc("flexy_mini_admin_create_verified_offer_execute", {
          p_phone: target,
          p_offer_uuid: chosen.offer_uuid,
          p_discovery_uuid: identity.discoveryUuid,
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
        setLastJob(job); refreshHistory();
        requestRef.current = { ...request, job };
        savePending(requestRef.current);
        setUnknownResult(false);
        message.success(result.reused ? "طلب موجود مسبقًا، لم يُكرر" : "تم إرسال الطلب إلى Station Connect");
      } catch {
        setUnknownResult(true);
        message.error("انقطع الاتصال. قد تكون العملية أُرسلت؛ لا تكررها.");
      } finally {
        setSendBusy(false); sendLock.current = false;
      }
    })();
  };

  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <Card>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap>
          <Tag color="green">Mobilis</Tag>
          <Tag>فليكسي Mobilis</Tag>
          {!isCustomer && <Tag color={executePrerequisitesReady ? "green" : "orange"}>
            {stationBusy ? "جاري فحص المحطة" : executePrerequisitesReady ? "Sama مستوفية للشروط الأساسية" : stationUuid ? "Sama للاستكشاف فقط" : "Sama غير جاهزة"}
          </Tag>}
        </Space>
        <Typography.Text strong>رقم هاتف الزبون</Typography.Text>
        <Input
          size="large" dir="ltr" inputMode="tel" autoComplete="tel"
          aria-label="رقم الهاتف المراد شحنه"
          placeholder="0XXXXXXXXX" value={phone}
          maxLength={20} disabled={sendBusy}
          prefix={<PhoneOutlined />}
          onChange={event => {
            const next = normalizePhone(event.target.value);
            if (next !== normalizePhone(phone)) {
              setMode("credit"); setIdentity(null); setChosenId(null); setFamily("all");
              setManual(false); setManualFamily(undefined); setManualAmount(null); setManualIndex("");
              setAmount(null); setConfirmSend(false);
            }
            setPhone(next);
          }}
        />
        <Segmented
          block
          size="large" disabled={sendBusy}
          options={[{ label: "رصيد عادي", value: "credit" }, { label: "عروض", value: "offers" }]}
          value={mode}
          onChange={value => {
            setMode(value as Mode); setConfirmSend(false);
            if (value === "offers") setOffersRequest(value => value + 1);
          }}
        />
      </Space>
    </Card>

    <Card title="عروض الزبون" style={{ display: mode === "offers" ? undefined : "none" }}>
      <CustomerOfferIdentity db={db} phone={phone} stationUuid={stationUuid}
        active={mode === "offers"} requestToken={offersRequest}
        isCustomer={isCustomer} onIdentity={handleIdentity} onJobChange={refreshHistory}/>
    </Card>
    {mode === "credit" ? <Card title="رصيد عادي">
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Alert showIcon type="warning" message="إرسال الرصيد العادي غير متاح حاليًا"
           />
        <Space wrap>{[100, 200, 500].map(value =>
          <Button key={value} type={amount === value ? "primary" : "default"}
            onClick={() => setAmount(value)}>{currency(value)}</Button>)}</Space>
        <InputNumber<number> min={1} max={100000} precision={0} value={amount}
          onChange={setAmount} style={{ width: "100%" }} size="large" placeholder="المبلغ" addonAfter="دج" />
        <Button block size="large" type="primary" disabled>إرسال الرصيد — غير مفعّل</Button>
      </Space>
    </Card> : <>
      <Card title="العروض" extra={<Button size="small" icon={<ReloadOutlined/>}
        onClick={() => void loadCatalog()} loading={loading}>تحديث</Button>}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {catalogError && <Alert type="error" showIcon message={catalogError}/>}

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

            </Space>
          </Card>}
        </Space>
      </Card>

      <Card title="تأكيد الطلب">
        <Space direction="vertical" size="middle" style={{width:"100%"}}>
          {chosen ? <Space wrap>
            <Tag color="blue">{chosen.display_name}</Tag>
            <Tag>{currency(chosen.amount)}</Tag>
            {routeCanSendThroughSama
              ? <Tag color="green"><CheckCircleOutlined/> المصدر: Sama</Tag>
              : routeChoice?.sim_type === "mobilis-arsselli"
                ? <Tag color="orange">Arsselli — تنفيذ العروض يحتاج اعتماد الربط</Tag>
                : <Tag color="orange">مصدر الإرسال غير جاهز</Tag>}
          </Space> : <Typography.Text type="secondary">اختر العرض من الأعلى.</Typography.Text>}
          {!isCustomer && chosen && (routeCheckBusy
            ? <Typography.Text type="secondary">جاري اختيار المصدر المتاح من السيرفر...</Typography.Text>
            : routeError
              ? <Alert type="warning" showIcon message="يرجى المحاولة بعد حين" description={routeError}/>
              : !routeChoice
                ? <Alert type="warning" showIcon message="الخدمة غير متاحة حاليًا، يرجى المحاولة بعد حين"
                    />
                : routeChoice.sim_type === "mobilis-arsselli"
                  ? <Alert type="warning" showIcon message="وجد النظام مصدر Arsselli"
                      />
                  : null)}
          {isCustomer
            ? <Alert type="info" showIcon message="إرسال الزبائن غير مفعّل"
                />
            : <Space direction="vertical" size="small" style={{width:"100%"}}>
              {stationError && <Alert type="error" message={stationError} showIcon/>}
              {routeCanSendThroughSama
                ? <Typography.Text type="secondary">مصدر الإرسال المختار: Sama — محطة {stationName}. </Typography.Text>
                : !routeChoice && samaStatus && chosen
                  ? <Typography.Text type="secondary">حالة Sama: {readinessProblems(samaStatus).join("، ")}</Typography.Text>
                  : null}
              <Space wrap>
                <Button size="small" loading={stationBusy} onClick={()=>{setRouteRefreshToken(value=>value+1);void loadStation();}}>تحديث مصادر الإرسال</Button>
                {onOpenStations&&<Button size="small" onClick={onOpenStations}>تجهيز المحطات والشرائح</Button>}
              </Space>
            </Space>}
          {lastJob && <Alert showIcon type={lastJob.status==="success"?"success":lastJob.status==="failed"?"warning":"info"}
            message={lastJob.status==="failed"
              ? "فشلت العملية، يرجى المحاولة بعد حين"
              : lastJob.status==="review" ? "طلبك قيد التحقق، لا تعاود الإرسال الآن"
                : "العملية: "+titleStatus(lastJob.status)}
            description={<Space direction="vertical" size={4}>
              <Typography.Text copyable={{text:lastJob.job_uuid}}>مرجع العملية: {lastJob.job_uuid}</Typography.Text>
              {lastJob.result_code&&<Typography.Text>رمز النتيجة: {lastJob.result_code}</Typography.Text>}
              <Button size="small" loading={jobCheckBusy} onClick={() => void checkJob()}>تحديث حالة العملية</Button>
              {(lastJob.status==="success"||lastJob.status==="failed")&&<Button size="small"
                onClick={() => {setLastJob(null);requestRef.current=null;savePending(null);setUnknownResult(false);}}>
                طلب جديد بعد مراجعة النتيجة
              </Button>}
            </Space>}
          />}
          {unknownResult && !lastJob && <Alert type="error" showIcon
            message="حالة الطلب غير مؤكدة"
            description="لا تغيّر الرقم أو العرض ولا تبدأ طلبًا جديدًا حتى تتأكد من العمليات. سيُستخدم نفس مفتاح العملية عند إعادة المحاولة."/>}
          <Button type="primary" size="large" block loading={sendBusy}
            disabled={isCustomer||!db||!routeCanSendThroughSama||!validPhone(normalizePhone(phone))||Boolean(lastJob)}
            onClick={() => submit()}>إرسال العرض</Button>

        </Space>
      </Card>
    </>}

    <Modal open={confirmSend} title="تأكيد إرسال العرض"
      okText="أؤكد الإرسال" cancelText="إلغاء" okButtonProps={{danger:true}}
      onCancel={() => setConfirmSend(false)} onOk={() => submit(true)}>
      <Typography.Paragraph>الرقم: <bdi dir="ltr">{normalizePhone(phone)}</bdi></Typography.Paragraph>
      <Typography.Paragraph>{chosen?.display_name} — {currency(chosen?.amount || 0)}</Typography.Paragraph>
      <Typography.Paragraph>المصدر: Sama. تكلفة الشريحة عند النجاح: {currency((chosen?.amount || 0) + 10)}. هذه عملية شحن حقيقية.</Typography.Paragraph>
    </Modal>
    {!isCustomer && db && <FlexyOperationHistory db={db} refreshToken={historyRefresh}/> }
  </Space>;
}
