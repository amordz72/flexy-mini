import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Alert, Button, Card, Input, Select, Space, Typography, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";

type CardType = { type_key: string; name: string; active: boolean };
const lines = (raw: string) => raw.split(/\r?\n/).map(x => x.trim()).filter(Boolean);

export default function CardCodeImportAdmin({ db }: { db: SupabaseClient }) {
  const [authorized, setAuthorized] = useState(false);
  const [checked, setChecked] = useState(false);
  const [types, setTypes] = useState<CardType[]>([]);
  const [typeKey, setTypeKey] = useState<string>();
  const [denomination, setDenomination] = useState("");
  const [codes, setCodes] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await db.rpc("flexy_mini_is_admin");
      if (!active) return;
      setAuthorized(!error && data === true);
      setChecked(true);
      if (!error && data === true) {
        const response = await db.from("card_stock_types").select("type_key,name,active").eq("active", true).order("name");
        if (!active) return;
        if (response.error) message.error("تعذر تحميل أنواع البطاقات");
        else setTypes((response.data || []) as CardType[]);
      }
    })();
    return () => { active = false; };
  }, [db]);
  const values = lines(codes);
  const unique = [...new Set(values)];
  const importCodes = async () => {
    if (!authorized || !typeKey || !denomination.trim() || !unique.length) return;
    setBusy(true);
    // Server must own code encryption, deduplication, and authorization.
    // Never insert plaintext codes into a browser-writable stock table.
    const { data, error } = await db.rpc("card_stock_admin_import_plain_lines", {
      p_type_key: typeKey,
      p_denomination: denomination.trim(),
      p_codes: unique,
      p_source_label: fileName || "إدخال يدوي"
    });
    setBusy(false);
    if (error) {
      message.error(error.code === "PGRST202" ? "خدمة الحفظ الآمن غير مفعّلة بعد على الخادم" : "تعذر الحفظ: " + error.message);
      return;
    }
    message.success("تم إرسال الدفعة للمخزون");
    setCodes("");
    setFileName("");
    void data;
  };
  if (!checked) return <Card loading />;
  if (!authorized) return <Alert type="error" showIcon message="هذه الصفحة مخصصة للإدارة فقط" />;
  return <Card title="إضافة أكواد البطاقات">
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert type="info" showIcon message="التحقق من طول وصيغة الأكواد مؤجل. الحفظ يتطلب خدمة الخادم الآمنة." />
      <Select placeholder="نوع البطاقة" value={typeKey} onChange={setTypeKey} style={{ width: "100%" }}
        options={types.map(t => ({ value: t.type_key, label: t.name }))} showSearch optionFilterProp="label" />
      <Input value={denomination} onChange={e => setDenomination(e.target.value)} placeholder="قيمة البطاقة، مثال 2000" />
      <Input.TextArea rows={7} dir="ltr" value={codes} onChange={e => { setCodes(e.target.value); setFileName(""); }}
        placeholder={"كود واحد أو مجموعة أكواد\nكل كود في سطر مستقل"} />
      <Upload accept=".txt,text/plain" maxCount={1} showUploadList={false} beforeUpload={async file => {
        try {
          const text = await file.text();
          setCodes(text);
          setFileName(file.name);
          message.success("تمت قراءة الملف محليًا؛ اضغط حفظ لإرساله");
        } catch { message.error("تعذرت قراءة الملف"); }
        return false;
      }}><Button icon={<UploadOutlined />}>اختيار ملف TXT</Button></Upload>
      <Typography.Text type="secondary">الأكواد: {values.length} — بدون تكرار داخل الدفعة: {unique.length}</Typography.Text>
      <Button type="primary" block loading={busy} disabled={!typeKey || !denomination.trim() || !unique.length} onClick={() => void importCodes()}>حفظ في المخزون</Button>
    </Space>
  </Card>;
}
