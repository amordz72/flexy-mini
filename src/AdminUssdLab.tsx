import { Alert, Card, Input, Button, Space, Typography } from 'antd';
import { useState } from 'react';

export default function AdminUssdLab() {
  const [code, setCode] = useState('');
  return <Card title="مختبر USSD">
    <Space direction="vertical" style={{width:'100%'}}>
      <Alert type="warning" message="التنفيذ متوقف حتى ربط واجهة الخادم الآمنة." showIcon />
      <Input value={code} onChange={e=>setCode(e.target.value)} placeholder="أدخل كود USSD" dir="ltr" />
      <Button disabled>تنفيذ عبر Station Connect</Button>
      <Typography.Text type="secondary">لا يتم إرسال أي أمر من هذه الشاشة حاليًا.</Typography.Text>
    </Space>
  </Card>;
}
