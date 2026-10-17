import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, InputNumber, Modal, Select, Space, Typography, message } from "antd";
import type { SupabaseClient } from "@supabase/supabase-js";
import ArsselliBalanceRefreshSettings from "./ArsselliBalanceRefreshSettings";

type SourceSimType = "mobilis-sama" | "mobilis-arsselli";
type RoutingPolicy = {
  operator_key: string;
  split_amount: number;
  below_split_sim_type: SourceSimType;
  at_or_above_sim_type: SourceSimType;
  updated_at: string;
};

const sources: {value:SourceSimType;label:string}[] = [
  {value:"mobilis-sama", label:"Sama"},
  {value:"mobilis-arsselli", label:"Arsselli — عروض 696"},
];
const sourceName = (value: SourceSimType) =>
  sources.find(row => row.value === value)?.label || value;

/** Editing priority changes neither route approval nor any network/financial operation. */
export default function OfferSourcePreferenceSettings({db}:{db:SupabaseClient}) {
  const [loaded,setLoaded] = useState<RoutingPolicy|null>(null);
  const [split,setSplit] = useState<number|null>(null);
  const [below,setBelow] = useState<SourceSimType>("mobilis-arsselli");
  const [above,setAbove] = useState<SourceSimType>("mobilis-sama");
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [confirmOpen,setConfirmOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);setError("");
    try {
      const {data,error:readError}=await db.rpc("flexy_mini_admin_offer_source_preference");
      if (readError) throw new Error(readError.message);
      const row=(Array.isArray(data)?data[0]:data) as RoutingPolicy|undefined;
      if(!row || !Number.isInteger(row.split_amount) || !row.updated_at)
        throw new Error("إعدادات أولوية التنفيذ غير متوفرة");
      setLoaded(row);setSplit(row.split_amount);
      setBelow(row.below_split_sim_type);setAbove(row.at_or_above_sim_type);
    } catch (cause) {
      setLoaded(null);
      setError(cause instanceof Error?cause.message:"تعذر جلب الإعدادات");
    } finally {setLoading(false);}
  },[db]);

  useEffect(()=>{void refresh();},[refresh]);
  const valid=Boolean(loaded && split!==null && Number.isInteger(split) && split>=1 && split<=50000);
  const changed=Boolean(loaded && (loaded.split_amount!==split
    || loaded.below_split_sim_type!==below || loaded.at_or_above_sim_type!==above));

  const save = async () => {
    if(!loaded || !valid || !changed || saving || split===null) return;
    setSaving(true);
    try {
      const {error:saveError}=await db.rpc("flexy_mini_admin_save_offer_source_preference",{
        p_split_amount:split,
        p_below_split_sim_type:below,
        p_at_or_above_sim_type:above,
        p_expected_updated_at:loaded.updated_at,
      });
      if(saveError) throw new Error(saveError.message);
      setConfirmOpen(false);
      message.success("حُفظ ترتيب مصادر تنفيذ العروض");
      await refresh();
    } catch (cause) {
      const reason=cause instanceof Error?cause.message:String(cause);
      message.error(reason.includes("SOURCE_PRIORITY_SETTINGS_STALE")
        ?"تغيّرت الإعدادات من جهاز آخر؛ حدّث الصفحة أولًا.":"فشل الحفظ: "+reason);
    } finally {setSaving(false);}
  };
  return <><Card title="أولوية تنفيذ عروض Mobilis" extra={
    <Button size="small" onClick={()=>void refresh()} loading={loading}>تحديث</Button>}>
    <Space direction="vertical" size="middle" style={{width:"100%"}}>
      <Alert type="info" showIcon message="الأولوية إعدادات وليست منعًا"
        description="يختار السيرفر المصدر المفضّل أولًا عندما يكون معتمدًا ومتاحًا. إذا تعذر، يبحث عن المصدر الآخر المعتمد لنفس العرض قبل بدء الإرسال. لا تعيد هذه الإعدادات عملية شحن نتيجتها معلّقة، ولا تنشّط مسارات Arsselli 696 التجريبية."/>
      {error && <Alert type="error" showIcon message={error}/>}
      <Space direction="vertical" size="small">
        <Typography.Text strong>حدّ الفصل بين المبالغ</Typography.Text>
        <InputNumber aria-label="حد الفصل لأولوية العروض" min={1} max={50000} precision={0}
          addonAfter="دج" value={split} onChange={setSplit} disabled={!loaded}
          style={{maxWidth:220,width:"100%"}}/>
        <Typography.Text type="secondary">المبلغ الأقل من هذا الحد يستخدم أولوية المجموعة الأولى؛ المساوي له والأكبر يستخدم المجموعة الثانية.</Typography.Text>
      </Space>
      <Space direction="vertical" size="small">
        <Typography.Text strong>المبالغ الأقل من الحد</Typography.Text>
        <Select aria-label="مصدر عروض أقل من حد الفصل" value={below}
          options={sources} onChange={setBelow} disabled={!loaded} style={{width:220}}/>
      </Space>
      <Space direction="vertical" size="small">
        <Typography.Text strong>المبالغ المساوية للحد وما فوقه</Typography.Text>
        <Select aria-label="مصدر عروض تساوي حد الفصل أو تفوقه" value={above}
          options={sources} onChange={setAbove} disabled={!loaded} style={{width:220}}/>
      </Space>
      <Button type="primary" disabled={!valid||!changed||saving} loading={saving}
        onClick={()=>setConfirmOpen(true)}>حفظ ترتيب الأولوية</Button>
      <Alert type="warning" showIcon message="أكواد الرصيد والعروض منفصلة"
        description="630 للرصيد العادي بحساب الموزّع (الحد المعروف 40 دج)، و696 لعروض Arsselli، و665 لعروض Sama. إعدادات الأولوية هنا تخص العروض المفعّلة فقط، ولا ترسل شحنًا ولا تغيّر نسب العملاء."/>
    </Space>
    <Modal title="تأكيد تغيير أولوية التنفيذ" open={confirmOpen}
      okText="تأكيد الحفظ" cancelText="إلغاء" confirmLoading={saving}
      okButtonProps={{disabled:!valid||!changed}}
      onCancel={()=>{if(!saving)setConfirmOpen(false);}} onOk={()=>void save()}>
      <Space direction="vertical">
        <Typography.Text>حد الفصل: {loaded?.split_amount} ← {split} دج</Typography.Text>
        <Typography.Text>الأقل: {loaded?sourceName(loaded.below_split_sim_type):"—"} ← {sourceName(below)}</Typography.Text>
        <Typography.Text>المساوي والأكبر: {loaded?sourceName(loaded.at_or_above_sim_type):"—"} ← {sourceName(above)}</Typography.Text>
        <Typography.Text type="secondary">لا يغيّر اعتماد أي مسار، ولا ينفّذ أمر USSD.</Typography.Text>
      </Space>
    </Modal>
  </Card><ArsselliBalanceRefreshSettings db={db}/></>;
}
