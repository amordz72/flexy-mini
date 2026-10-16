import { useEffect, useState } from "react";
import { Alert, Button, Card, Descriptions, Empty, Select, Space, Spin, Tag, Typography } from "antd";
import type { SupabaseClient } from "@supabase/supabase-js";

type Customer = { id: number; username: string };
type Variant = { id: number; product_id: number; name: string; denomination: number };
type Preview = {
  status: string;
  quote_only: boolean;
  financial_dispatch_enabled: boolean;
  username: string;
  product_name: string;
  variant_name: string;
  discount_percent: number | null;
  retail_price: number | null;
  purchase_price: number | null;
  customer_charge: number | null;
  margin_before_other_fees: number | null;
  stock_quantity: number | null;
  in_stock: boolean;
};
const reasons: Record<string, string> = {
  preview_only: "الحساب ممكن للمعاينة، وليس تأكيد بيع أو شحن",
  out_of_stock: "المخزون صفر أو غير مؤكد؛ ممنوع اعتبار الخدمة جاهزة للبيع",
  inactive_customer: "حساب الزبون معطّل",
  inactive_or_frozen: "المنتج أو النوع معطّل أو مجمّد",
  rate_unset: "نسبة هذا الزبون غير محددة، ولا نعوضها بالافتراضي",
  sale_price_unset: "سعر البيع غير محفوظ أو يساوي صفرًا",
  purchase_price_unset: "سعر الشراء الحقيقي غير محفوظ أو يساوي صفرًا"
};
const cash = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " دج";

export default function FlexyCardQuotePreview({ db, customers, serviceKey, serviceLabel }: {
  db?: SupabaseClient;
  customers: Customer[];
  serviceKey: string;
  serviceLabel: string;
}) {
  const productId = /^card:[1-9][0-9]*$/.test(serviceKey) ? Number(serviceKey.slice(5)) : null;
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (customerId !== null && !customers.some(c => c.id === customerId)) setCustomerId(null);
  }, [customerId, customers]);

  useEffect(() => {
    let live = true;
    setVariantId(null);
    setVariants([]);
    setPreview(null);
    setError("");
    if (!db || !productId) return () => { live = false; };
    setLoading(true);
    void db.from("flexy_mini_variants")
      .select("id,product_id,name,denomination")
      .eq("product_id", productId)
      .order("id", { ascending: true })
      .limit(100)
      .then(({ data, error: readError }) => {
        if (!live) return;
        if (readError) setError("تعذر قراءة الأنواع: " + readError.message);
        else setVariants((data ?? []) as Variant[]);
        setLoading(false);
      });
    return () => { live = false; };
  }, [db, productId]);

  const runPreview = async () => {
    if (!db || customerId === null || variantId === null || previewLoading) return;
    setPreview(null);
    setError("");
    setPreviewLoading(true);
    try {
      const { data, error: rpcError } = await db.rpc("flexy_mini_admin_card_price_preview", {
        p_customer_id: customerId, p_variant_id: variantId
      });
      if (rpcError) throw rpcError;
      if (!data || typeof data !== "object" || data.quote_only !== true || data.financial_dispatch_enabled !== false) {
        throw new Error("السيرفر لم يؤكد أنها معاينة غير مالية");
      }
      setPreview(data as Preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر معاينة السعر");
    } finally {
      setPreviewLoading(false);
    }
  };

  return <Card size="small" title="معاينة سعر البيع — بدون إرسال">
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert showIcon type="info"
        message="الخصم المحفوظ والسعر والتكلفة من السيرفر فقط"
        description="لا يتغير السعر في أي طلب قائم، ولا يُنشئ هذا الفحص طلبًا أو يحجز بطاقة أو ينفذ رصيدًا."/>
      {!productId ? <Empty description="اختر في الفلتر أعلاه فئة البطاقات أو الإنترنت أو الألعاب، ثم المنتج المطلوب. الفليكسي العادي والمفعّل يحتاجان تسعير مصدر التنفيذ، ولم نربطهما هنا."/> :
        <>
          <Typography.Text strong>{serviceLabel}</Typography.Text>
          <Typography.Text type="secondary">الزبون</Typography.Text>
          <Select showSearch optionFilterProp="label" style={{ width: "100%" }}
            value={customerId} onChange={value => { setCustomerId(value); setPreview(null); }}
            placeholder="اختر زبونًا موجودًا"
            options={customers.map(c => ({ value: c.id, label: c.username }))}/>
          <Typography.Text type="secondary">نوع البطاقة / المبلغ</Typography.Text>
          <Select showSearch optionFilterProp="label" style={{ width: "100%" }}
            loading={loading} value={variantId} placeholder="اختر النوع"
            onChange={value => { setVariantId(value); setPreview(null); }}
            options={variants.map(v => ({ value: v.id, label: v.name || String(v.denomination) + " دج" }))}/>
          <Button block type="primary" loading={previewLoading} disabled={loading || !db || customerId === null || variantId === null}
            onClick={() => void runPreview()}>حساب السعر والربح — معاينة فقط</Button>
        </>
      }
      {error && <Alert showIcon type="error" message={error}/>}
      {previewLoading && <Spin/>}
      {preview && <>
        <Alert showIcon type={preview.status === "preview_only" ? "success" : "warning"}
          message={reasons[preview.status] ?? "المصدر غير جاهز للمعاينة"}
          description="المعاينة لا تؤكد توفر الخدمة ولا تسمح بالدفع."/>
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="المنتج">{preview.product_name} — {preview.variant_name}</Descriptions.Item>
          <Descriptions.Item label="نسبة الزبون">
            {preview.discount_percent === null ? "غير محددة" : preview.discount_percent + "%"}
          </Descriptions.Item>
          <Descriptions.Item label="سعر البيع">
            {preview.retail_price === null ? "غير محفوظ" : cash(preview.retail_price)}
          </Descriptions.Item>
          <Descriptions.Item label="تكلفة الشراء">
            {preview.purchase_price === null || preview.purchase_price <= 0 ? "غير محددة" : cash(preview.purchase_price)}
          </Descriptions.Item>
          <Descriptions.Item label="السعر بعد الخصم">
            {preview.customer_charge === null ? "لا يمكن حسابه" : cash(preview.customer_charge)}
          </Descriptions.Item>
          <Descriptions.Item label="الربح قبل المصاريف الأخرى">
            {preview.margin_before_other_fees === null ? "لا يمكن حسابه" :
              <Tag color={preview.margin_before_other_fees < 0 ? "red" : "green"}>{cash(preview.margin_before_other_fees)}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="المخزون">{preview.stock_quantity ?? "غير معروف"}</Descriptions.Item>
        </Descriptions>
      </>}
    </Space>
  </Card>;
}
