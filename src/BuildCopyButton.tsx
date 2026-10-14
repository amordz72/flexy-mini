import { CopyOutlined } from "@ant-design/icons";
import { FloatButton, Input, Modal, message } from "antd";

// Vite embeds these values into the JavaScript bundle at build time.
// They identify the version actually loaded in the browser/PWA, not GitHub's latest source.
const buildSha = String(import.meta.env.VITE_BUILD_SHA || "").trim();
const buildTime = String(import.meta.env.VITE_BUILD_TIME || "").trim();
const buildRun = String(import.meta.env.VITE_BUILD_RUN_ID || "").trim();

function currentVersionReport(): string {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return [
    "Flexy Mini — تقرير نسخة الواجهة",
    "كود النسخة المحمّلة: " + (buildSha || "غير متاح (بناء محلي أو قديم)"),
    "وقت بناء النسخة UTC: " + (buildTime || "غير متاح"),
    "GitHub Actions Run ID: " + (buildRun || "غير متاح"),
    "الصفحة: " + window.location.pathname + window.location.hash,
    "طريقة الفتح: " + (standalone ? "تطبيق مثبت PWA" : "متصفح"),
    "تحكم Service Worker: " + (navigator.serviceWorker?.controller ? "نعم" : "لا"),
    "الاتصال الحالي: " + (navigator.onLine ? "متصل بالشبكة" : "غير متصل بالشبكة"),
    "وقت نسخ التقرير: " + new Date().toISOString(),
    "ملاحظة: هذا كود البناء الذي يعرضه الجهاز، وليس بالضرورة أحدث Commit على GitHub."
  ].join("\n");
}

export default function BuildCopyButton() {
  const copyReport = async () => {
    const report = currentVersionReport();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(report);
      message.success("تم نسخ تقرير نسخة الواجهة. الصقه في المحادثة.");
    } catch {
      Modal.info({
        title: "تقرير نسخة الواجهة — انسخ النص",
        content: <Input.TextArea value={report} readOnly autoSize={{ minRows: 7, maxRows: 13 }} onFocus={event => event.target.select()} />,
        okText: "إغلاق",
        width: 520
      });
    }
  };

  return <FloatButton
    type="primary"
    shape="circle"
    icon={<CopyOutlined />}
    tooltip={buildSha ? "نسخ تقرير النسخة " + buildSha.slice(0, 7) : "نسخ تقرير نسخة الواجهة"}
    aria-label="نسخ تقرير نسخة الواجهة"
    onClick={() => void copyReport()}
    style={{ position: "fixed", top: 68, left: 8, right: "auto", bottom: "auto", width: 40, height: 40, zIndex: 100 }}
  />;
}
