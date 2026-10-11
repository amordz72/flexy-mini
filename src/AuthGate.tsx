import { useEffect, useState } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { Alert, Button, Card, Form, Input, Space, Spin, Typography } from "antd";

const { Text, Title } = Typography;
type Props = { client?: SupabaseClient; children: (session: Session | null) => React.ReactNode };

export function AuthGate({ client, children }: Props) {
  const [loading, setLoading] = useState(Boolean(client));
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setSession(sessionError ? null : data.session);
      setLoading(false);
    }).catch(() => {
      if (active) { setSession(null); setLoading(false); setError("تعذر التحقق من الجلسة."); }
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) { setSession(nextSession); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client]);

  if (!client) return <>{children(null)}</>;
  if (loading) return <div className="auth-screen"><Spin size="large" tip="التحقق من الجلسة"><div className="auth-spinner" /></Spin></div>;
  if (session) return <>{children(session)}</>;

  async function signIn(values: { email: string; password: string }) {
    if (!client) return;
    setError("");
    setSubmitting(true);
    try {
      const { error: loginError } = await client.auth.signInWithPassword({
        email: values.email.trim(), password: values.password,
      });
      if (loginError) setError("تعذر تسجيل الدخول. تحقق من البيانات أو صلاحية الحساب.");
    } catch {
      setError("تعذر الاتصال بخدمة تسجيل الدخول.");
    } finally {
      setSubmitting(false);
    }
  }
  return <div className="auth-screen" dir="rtl">
    <Card className="auth-card">
      <Title level={3}>⚡ فليكسي ميني</Title>
      <Text type="secondary">تسجيل الدخول إلى لوحة الإدارة</Text>
      {error && <Alert type="error" showIcon message={error} className="auth-error" />}
      <Form layout="vertical" onFinish={signIn} className="auth-form" requiredMark={false}>
        <Form.Item label="البريد الإلكتروني" name="email" rules={[{ required: true, type: "email", message: "أدخل بريدًا إلكترونيًا صحيحًا" }]}>
          <Input autoComplete="username" type="email" dir="ltr" size="large" />
        </Form.Item>
        <Form.Item label="كلمة المرور" name="password" rules={[{ required: true, message: "أدخل كلمة المرور" }]}>
          <Input.Password autoComplete="current-password" dir="ltr" size="large" />
        </Form.Item>
        <Space direction="vertical" className="auth-actions">
          <Button htmlType="submit" type="primary" size="large" block loading={submitting}>دخول</Button>
          <Text type="secondary">لا يوجد تسجيل حساب جديد في هذه النسخة. يجب تجهيز المستخدم والصلاحيات في Supabase.</Text>
        </Space>
      </Form>
    </Card>
  </div>;
}
