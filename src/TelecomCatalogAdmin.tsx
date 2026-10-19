import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Typography, message } from "antd";
import type { SupabaseClient } from "@supabase/supabase-js";

type Operator = { operator_key: string; display_name: string; enabled: boolean };
type SimType = { sim_type: string; display_name: string; operator_key: string; enabled: boolean; phone_lookup_code: string | null };
type Offer = {
  offer_uuid: string; operator: string; group_code: string; family: string;
  amount: number; display_name: string; active: boolean; execution_enabled: boolean;
  admin_visibility: string; customer_visibility: string;
  sort_index: number; updated_at: string;
};
type Route = {
  route_uuid: string; offer_uuid: string; sim_type: string; execution_method: string;
  status: string; enabled: boolean; priority: number; verified_at: string | null;
};
type Source = {
  offer_uuid: string; source_uuid: string | null; source_kind: string | null;
  source_name: string | null; observed_via_sim_type: string | null;
};
type CodeSimBinding = { sim_type: string; display_name: string; enabled: boolean; auto_allowed: boolean };
type UssdCode = {
  ussd_uuid: string; operator_key: string; title_ar: string; purpose_key: string;
  sim_profile: string; code_template: string; knowledge_status: string;
  implementation_status: string; last_verified_at: string | null; sim_types: CodeSimBinding[];
};
type CatalogData = { operators: Operator[]; simTypes: SimType[]; offers: Offer[];
  routes: Route[]; sources: Source[]; codes: UssdCode[] };

const empty: CatalogData = { operators: [], simTypes: [], offers: [], routes: [], sources: [], codes: [] };
const labelFor = (key: string, operators: Operator[]) =>
  operators.find(row => row.operator_key === key)?.display_name || key;
const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "ar"));

/**
 * Admin-only overview of canonical operator/offer/route/code records.
 * Product prices, customer cards, modems and individual SIMs are deliberately not copied here.
 * The only mutation is a confirmed presentation-order RPC with its own admin check.
 * No financial or USSD command is sent.
 */
export default function TelecomCatalogAdmin({ db }: { db: SupabaseClient }) {
  const [data, setData] = useState<CatalogData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState("offers");
  const [operator, setOperator] = useState("all");
  const [family, setFamily] = useState("all");
  const [simType, setSimType] = useState("all");
  const [search, setSearch] = useState("");
  const [purpose, setPurpose] = useState("all");
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [targetPosition, setTargetPosition] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [operators, simTypes, offers, routes, sources, codes] = await Promise.all([
          db.rpc("station_connect_admin_operators"),
          db.rpc("station_connect_admin_sim_types"),
          db.rpc("admin_flexy_list_offer_catalog"),
          db.rpc("admin_flexy_offer_execution_routes", { p_offer_uuid: null }),
          db.rpc("admin_flexy_offer_source_matrix", {
            p_operator: null, p_family: null, p_observed_via_sim_type: null,
          }),
          db.rpc("mytool_admin_ussd_code_matrix"),
        ]);
        const results = [operators, simTypes, offers, routes, sources, codes];
        const failure = results.find(result => result.error);
        if (failure?.error) throw new Error(failure.error.message);
        if (results.some(result => !Array.isArray(result.data))) {
          throw new Error("رد غير متوقع من خدمة الكاتالوجات");
        }
        if (!active) return;
        setData({
          operators: operators.data as Operator[],
          simTypes: simTypes.data as SimType[],
          offers: offers.data as Offer[],
          routes: routes.data as Route[],
          sources: sources.data as Source[],
          codes: codes.data as UssdCode[],
        });
      } catch (cause) {
        if (active) {
          setData(empty);
          setError("تعذر قراءة كاتالوجات الإدارة: " +
            (cause instanceof Error ? cause.message : "خطأ غير معروف"));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [db, refresh]);

  const networkOptions = useMemo(() => [
    { value: "all", label: "كل المتعاملين" },
    ...data.operators.filter(item => item.operator_key !== "unknown").map(item => ({
      value: item.operator_key, label: item.display_name,
    })),
  ], [data.operators]);

  const families = useMemo(() => unique(
    data.offers.filter(offer => operator === "all" || offer.operator === operator)
      .map(offer => offer.family),
  ), [data.offers, operator]);

  const simTypes = useMemo(() => data.simTypes
    .filter(item => operator === "all" || item.operator_key === operator)
    .map(item => ({ value: item.sim_type, label: item.display_name })),
  [data.simTypes, operator]);

  const familyOrdered = (offer: Offer) => data.offers
    .filter(item => item.operator === offer.operator && item.family === offer.family)
    .sort((a, b) => (a.sort_index ?? 999999) - (b.sort_index ?? 999999)
      || a.amount - b.amount || a.offer_uuid.localeCompare(b.offer_uuid));
  const viewPosition = (offer: Offer) => familyOrdered(offer)
    .findIndex(item => item.offer_uuid === offer.offer_uuid) + 1;

  const openViewEdit = (offer: Offer) => {
    setEditingOffer(offer);
    setTargetPosition(viewPosition(offer));
  };

  const saveViewOrder = async () => {
    if (!editingOffer || targetPosition === null || !Number.isInteger(targetPosition) ||
      targetPosition < 1 || targetPosition > familyOrdered(editingOffer).length) return;
    setSavingOrder(true);
    try {
      const { error: saveError } = await db.rpc("flexy_mini_admin_offer_view_reorder", {
        p_offer_uuid: editingOffer.offer_uuid,
        p_target_position: targetPosition,
        p_expected_updated_at: editingOffer.updated_at,
      });
      if (saveError) throw new Error(saveError.message);
      setEditingOffer(null);
      setTargetPosition(null);
      setRefresh(value => value + 1);
      message.success("تم حفظ View Index وترتيب عروض العائلة");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "خطأ غير معروف";
      message.error(reason.includes("VIEW_ORDER_STALE_RELOAD")
        ? "تغيّر ترتيب العروض. حدّث القائمة وحاول مجددًا."
        : "فشل حفظ ترتيب العرض: " + reason);
    } finally {
      setSavingOrder(false);
    }
  };

  const filteredOffers = useMemo(() => data.offers.filter(offer => {
    if (operator !== "all" && offer.operator !== operator) return false;
    if (family !== "all" && offer.family !== family) return false;
    if (simType !== "all" &&
      !data.routes.some(route => route.offer_uuid === offer.offer_uuid && route.sim_type === simType)) return false;
    const query = search.trim().toLocaleLowerCase();
    return !query || [offer.display_name, offer.family, offer.group_code, String(offer.amount)]
      .some(value => String(value || "").toLocaleLowerCase().includes(query));
  }).sort((a, b) => a.operator.localeCompare(b.operator)
    || a.family.localeCompare(b.family)
    || (a.sort_index ?? 999999) - (b.sort_index ?? 999999)
    || a.amount - b.amount), [data.offers, data.routes, operator, family, simType, search]);

  const filteredCodes = useMemo(() => data.codes.filter(code => {
    if (operator !== "all" && code.operator_key !== operator) return false;
    if (purpose !== "all" && code.purpose_key !== purpose) return false;
    const query = search.trim().toLocaleLowerCase();
    return !query || [code.title_ar, code.purpose_key, code.sim_profile, code.code_template]
      .some(value => String(value || "").toLocaleLowerCase().includes(query));
  }), [data.codes, operator, purpose, search]);

  const sourceLabel = (kind: string) =>
    ({ live_discovery: "اكتشاف شبكة", manual: "إدخال يدوي", image: "صورة",
       import: "استيراد", external: "مصدر خارجي" } as Record<string, string>)[kind] || kind;

  const offerDetail = (offer: Offer) => {
    const routes = data.routes.filter(route => route.offer_uuid === offer.offer_uuid);
    const sources = data.sources.filter(row => row.offer_uuid === offer.offer_uuid && row.source_uuid);
    return <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space wrap>
        <Typography.Text type="secondary">مصادر المعرفة:</Typography.Text>
        {sources.length === 0 ? <Tag>لا يوجد مصدر مسجل</Tag> :
          unique(sources.map(source => source.source_kind || "unknown"))
            .map(kind => <Tag key={kind}>{sourceLabel(kind)}</Tag>)}
      </Space>
      <Typography.Text strong>مسارات التنفيذ المرتبطة بالعرض</Typography.Text>
      <Table<Route> rowKey="route_uuid" size="small" dataSource={routes}
        pagination={false} scroll={{ x: 560 }}
        locale={{ emptyText: "العرض محفوظ، وليس لديه أي مسار تنفيذ مسجل" }}
        columns={[
          { title: "نوع الشريحة", key: "sim", render: (_, route) =>
            data.simTypes.find(item => item.sim_type === route.sim_type)?.display_name || route.sim_type },
          { title: "الطريقة", dataIndex: "execution_method", key: "method" },
          { title: "الأولوية", dataIndex: "priority", key: "priority" },
          { title: "حالة المسار", key: "status", render: (_, route) =>
            <Tag color={route.status === "verified" && route.enabled ? "green" : "orange"}>
              {route.status === "verified" && route.enabled ? "مسجل ومفعّل" : route.status === "draft" ? "مسودة" : "غير مفعّل"}
            </Tag> },
        ]}/>
      <Typography.Text type="secondary">
        حالة المسار في الكاتالوج لا تثبت وجود شريحة متصلة أو رصيد كافٍ، ولا تسمح وحدها بالإرسال.
      </Typography.Text>
    </Space>;
  };

  return <Card title="الاتصالات والشبكات"
    extra={<Button size="small" onClick={() => setRefresh(value => value + 1)} loading={loading}>تحديث</Button>}>
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {error && <Alert type="error" showIcon message={error}/>}
      <Space wrap>
        <Select aria-label="المتعامل" style={{ width: 190 }} value={operator}
          options={networkOptions} onChange={value => { setOperator(value); setFamily("all"); setSimType("all"); setPurpose("all"); }}/>
        <Input.Search aria-label="البحث في الكاتالوجات" allowClear
          placeholder="بحث في العروض أو الأكواد" style={{ width: 210 }}
          value={search} onChange={event => setSearch(event.target.value)}/>
      </Space>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: "offers", label: "كاتالوجات العروض", children: <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap>
            <Select aria-label="عائلة العرض" style={{ width: 190 }} value={family}
              options={[{ value: "all", label: "كل العائلات" },
                ...families.map(value => ({ value, label: value }))]}
              onChange={setFamily}/>
            <Select aria-label="نوع شريحة مسار التنفيذ" style={{ width: 210 }} value={simType}
              options={[{ value: "all", label: "جميع أنواع الشرائح" }, ...simTypes]}
              onChange={setSimType}/>
            <Tag>{filteredOffers.length} عرض</Tag>
          </Space>
          <Table<Offer> rowKey="offer_uuid" loading={loading} size="small"
            dataSource={filteredOffers} scroll={{ x: 660 }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            locale={{ emptyText: <Empty description="لا توجد عروض مسجلة ضمن هذه الفلاتر" /> }}
            expandable={{ expandedRowRender: offerDetail }}
            columns={[
              { title: "المتعامل", key: "operator", render: (_, offer) => labelFor(offer.operator, data.operators) },
              { title: "العائلة", dataIndex: "family", key: "family" },
              { title: "العرض", key: "offer", render: (_, offer) => offer.display_name || String(offer.amount) },
              { title: "القيمة", key: "amount", render: (_, offer) => String(offer.amount) + " دج" },
              { title: "حالة العرض", key: "active", render: (_, offer) =>
                <Tag color={offer.active ? "green" : "default"}>{offer.active ? "نشط" : "معطل"}</Tag> },
              { title: "View Index", key: "view", render: (_, offer) => <Space size="small">
                <Typography.Text>{viewPosition(offer)}</Typography.Text>
                <Button size="small" onClick={() => openViewEdit(offer)}
                  aria-label={"تعديل ترتيب ظهور " + offer.display_name}>تعديل</Button>
              </Space> },
            ]}/>
          <Typography.Text type="secondary">
            عرض واحد لكل هوية تجارية؛ الشريحة ومسار التنفيذ منفصلان. غياب المسار لا يحذف العرض.
          </Typography.Text>
        </Space> },
        { key: "types", label: "أنواع الشرائح", children: <Space direction="vertical" size="middle" style={{width:"100%"}}>
          <Alert type="info" showIcon message="المتعامل ← نوع الشريحة ← الأكواد المرتبطة"
            description="هذه روابط تعريفية محفوظة؛ لا تثبت جاهزية التنفيذ ولا ترسل أوامر إلى الشبكة."/>
          <Table<SimType> rowKey="sim_type" loading={loading} size="small"
            dataSource={data.simTypes.filter(t => operator === "all" || t.operator_key === operator)}
            pagination={{pageSize:10,showSizeChanger:false}} scroll={{x:640}}
            expandable={{expandedRowRender: t => {
              const linked=data.codes.filter(c=>c.operator_key===t.operator_key &&
                (c.sim_types||[]).some(b=>b.sim_type===t.sim_type));
              return <Table<UssdCode> rowKey="ussd_uuid" size="small" pagination={false}
                scroll={{x:630}} dataSource={linked}
                locale={{emptyText:"لا توجد أكواد مرتبطة بهذا النوع؛ نطاق التعريف ليس ربطًا فعليًا"}}
                columns={[
                  {title:"الخدمة",dataIndex:"title_ar"},
                  {title:"الغرض",dataIndex:"purpose_key"},
                  {title:"صيغة الكود",render:(_,code)=><Typography.Text code dir="ltr">{code.code_template}</Typography.Text>},
                  {title:"الربط",render:(_,code)=>{
                    const b=(code.sim_types||[]).find(x=>x.sim_type===t.sim_type);
                    return <Space wrap size={4}>
                      <Tag color={b?.enabled?"green":"default"}>{b?.enabled?"مفعّل":"معطّل"}</Tag>
                      <Tag>{b?.auto_allowed?"سماح آلي مسجل":"بدون سماح آلي"}</Tag>
                    </Space>;
                  }}
                ]}/>;
            }}}
            columns={[
              {title:"المتعامل",render:(_,t)=>labelFor(t.operator_key,data.operators)},
              {title:"نوع الشريحة",dataIndex:"display_name"},
              {title:"المعرف",dataIndex:"sim_type",render:(v:string)=><Typography.Text code>{v}</Typography.Text>},
              {title:"الحالة",render:(_,t)=><Tag color={t.enabled?"green":"default"}>{t.enabled?"مفعّل":"معطّل"}</Tag>},
              {title:"عدد روابط الأكواد",render:(_,t)=>data.codes.filter(c=>
                (c.sim_types||[]).some(b=>b.sim_type===t.sim_type)).length},
              {title:"كود معرفة الرقم المسجل",render:(_,t)=>t.phone_lookup_code
                ? <Typography.Text code dir="ltr">{t.phone_lookup_code}</Typography.Text>:"غير مسجل"}
            ]}/>
        </Space> },
        { key: "codes", label: "الأكواد التشغيلية", children: <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap>
            <Select aria-label="الغرض من الكود" style={{ width: 210 }} value={purpose}
              options={[{ value: "all", label: "جميع أغراض الأكواد" },
                ...unique(data.codes.filter(code => operator === "all" || code.operator_key === operator)
                  .map(code => code.purpose_key)).map(value => ({ value, label: value }))]}
              onChange={setPurpose}/>
            <Tag>{filteredCodes.length} كود</Tag>
          </Space>
          <Table<UssdCode> rowKey="ussd_uuid" loading={loading} size="small"
            dataSource={filteredCodes} scroll={{ x: 680 }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            locale={{ emptyText: "لا توجد أكواد لهذا النطاق" }}
            columns={[
              { title: "المتعامل", key: "operator", render: (_, code) => labelFor(code.operator_key, data.operators) },
              { title: "الكود / الخدمة", dataIndex: "title_ar", key: "title" },
              { title: "الغرض", dataIndex: "purpose_key", key: "purpose" },
              { title: "نطاق التعريف", dataIndex: "sim_profile", key: "profile" },
               { title: "الروابط الفعلية", key: "binding", render: (_, code) =>
                 (code.sim_types||[]).length ?
                   <Space wrap size={2}>{code.sim_types.map(link =>
                     <Tag key={link.sim_type} color={link.enabled?"green":"default"}>
                       {link.display_name}{link.auto_allowed?" · آلي مسجل":""}
                     </Tag>)}</Space> : <Tag>غير مربوط</Tag> },
              { title: "دليل المعرفة", key: "knowledge", render: (_, code) =>
                <Tag color={code.knowledge_status === "confirmed" ? "green" : "orange"}>{code.knowledge_status}</Tag> },
              { title: "حالة التطبيق", key: "implementation", render: (_, code) =>
                <Tag>{code.implementation_status}</Tag> },
            ]}/>
          <Alert type="info" showIcon
            message="توثيق صحة الكود مستقل عن السماح بالشحن."
            description="نطاق تعريف الكود ليس إثباتًا لربطه بشريحة فعلية. الأكواد هنا للعرض الإداري فقط، دون اختبار شبكة أو تنفيذ USSD."/>
        </Space> },
      ]}/>
      <Modal title="تأكيد تعديل View Index" open={Boolean(editingOffer)}
        okText="تأكيد الحفظ" cancelText="إلغاء" confirmLoading={savingOrder}
        okButtonProps={{ disabled: !editingOffer || targetPosition === null ||
          !Number.isInteger(targetPosition) || targetPosition < 1 ||
          targetPosition > (editingOffer ? familyOrdered(editingOffer).length : 0) }}
        onOk={() => void saveViewOrder()}
        onCancel={() => { if (!savingOrder) { setEditingOffer(null); setTargetPosition(null); } }}>
        {editingOffer && <Space direction="vertical" size="middle" style={{width:"100%"}}>
          <Typography.Text strong>{editingOffer.display_name} — {editingOffer.family}</Typography.Text>
          <Typography.Text>الترتيب الحالي: {viewPosition(editingOffer)}</Typography.Text>
          <Space wrap>
            <Typography.Text>الترتيب الجديد:</Typography.Text>
            <InputNumber aria-label="View Index الجديد" inputMode="numeric" min={1}
              max={familyOrdered(editingOffer).length} precision={0}
              value={targetPosition} onChange={setTargetPosition}/>
          </Space>
          <Alert type="info" showIcon message="سيُعاد ترتيب عروض نفس المتعامل والعائلة فقط."
            description="لن يتغير Network Index ولا نوع الشريحة أو مسار التنفيذ، ولن تُرسل أي عملية فليكسي."/>
        </Space>}
      </Modal>
    </Space>
  </Card>;
}
