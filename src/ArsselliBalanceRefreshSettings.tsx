import {useCallback,useEffect,useState} from "react";
import {Alert,Button,Card,Modal,Select,Space,Typography,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";

type Policy={refresh_hours:6|12;updated_at:string};

/** Set once in Settings. Recharge ALWAYS uses the cumulative operational
 * balance, never a mandatory network query per transaction. */
export default function ArsselliBalanceRefreshSettings({db}:{db:SupabaseClient}){
  const [saved,setSaved]=useState<Policy|null>(null);
  const [hours,setHours]=useState<6|12>(6);
  const [busy,setBusy]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [confirm,setConfirm]=useState(false);
  const refresh=useCallback(async()=>{
    setBusy(true);setError("");
    try{
      const {data,error:readError}=await db.rpc("station_connect_admin_arsselli_refresh_policy");
      if(readError)throw new Error(readError.message);
      const row=(Array.isArray(data)?data[0]:data) as Policy|null;
      if(!row || ![6,12].includes(row.refresh_hours) || !row.updated_at)
        throw new Error("إعدادات تحديث الرصيد غير متوفرة");
      setSaved(row);setHours(row.refresh_hours);
    }catch(e){
      setSaved(null);setError(e instanceof Error?e.message:"تعذر قراءة الإعدادات");
    }finally{setBusy(false);}
  },[db]);
  useEffect(()=>{void refresh();},[refresh]);
  const changed=Boolean(saved&&saved.refresh_hours!==hours);
  const save=async()=>{
    if(!saved||!changed||saving)return;
    setSaving(true);
    try{
      const {error:saveError}=await db.rpc("station_connect_admin_save_arsselli_refresh_policy",{
        p_refresh_hours:hours,p_expected_updated_at:saved.updated_at
      });
      if(saveError)throw new Error(saveError.message);
      setConfirm(false);
      message.success("تم تحديث فترة قراءة رصيد أرسلي");
      await refresh();
    }catch(e){
      const reason=e instanceof Error?e.message:String(e);
      message.error(reason.includes("BALANCE_REFRESH_SETTINGS_STALE")
        ?"تغيّرت الإعدادات من جهاز آخر؛ اضغط تحديث ثم حاول من جديد."
        :"تعذر حفظ فترة التحديث: "+reason);
    }finally{setSaving(false);}
  };
  return <Card title="رصيد أرسلي التراكمي" extra={
    <Button size="small" loading={busy} onClick={()=>void refresh()}>تحديث</Button>}>
    <Space direction="vertical" size="middle" style={{width:"100%"}}>
      <Typography.Text>يحتفظ السيرفر بآخر رصيد مؤكّد لكل حساب موزّع، ويخصم العمليات الناجحة والحجوزات غير المحسومة تلقائيًا.</Typography.Text>
      <Typography.Text strong>الفاصل بين استعلامات الشبكة 632</Typography.Text>
      <Select aria-label="فترة التحقق من رصيد أرسلي"
        value={hours} disabled={!saved} style={{width:210}}
        options={[{value:6,label:"كل 6 ساعات"},{value:12,label:"كل 12 ساعة"}]}
        onChange={setHours}/>
      <Typography.Text type="secondary">لا نفحص الشبكة بعد كل عملية. عند انتهاء المدة يُستعمل استعلام واحد موجود أو يُطلب تحديث غير مالي، ثم تواصل شاشة الفليكسي تلقائيًا.</Typography.Text>
      {error&&<Alert type="error" showIcon message={error}/>}
      <Button type="primary" disabled={!changed||saving||busy}
        onClick={()=>setConfirm(true)}>حفظ المدة</Button>
    </Space>
    <Modal title="تأكيد فترة تحديث رصيد أرسلي" open={confirm}
      okText="تأكيد الحفظ" cancelText="إلغاء" confirmLoading={saving}
      okButtonProps={{disabled:!changed}}
      onOk={()=>void save()} onCancel={()=>{if(!saving)setConfirm(false)}}>
      <Typography.Text>تتغير المدة من {saved?.refresh_hours} إلى {hours} ساعة. لا يبدأ هذا الحفظ عملية USSD أو شحن.</Typography.Text>
    </Modal>
  </Card>;
}
