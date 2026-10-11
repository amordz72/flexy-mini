import React,{useEffect,useState} from "react";
import {Card,Button,InputNumber,Space,Typography,Alert,message,Modal} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";
export default function AdminWallet({db}:{db:SupabaseClient}){
 const [open,setOpen]=useState(false);const [balance,setBalance]=useState<number|null>(null),[amount,setAmount]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=async()=>{setBusy(true);const r=await db.rpc("flexy_mini_demo_wallet_topup",{p_amount:0});setBusy(false);if(r.error)setError("تعذر تحميل المحفظة: "+r.error.message);else{setBalance(Number(r.data));setError("");}};
 useEffect(()=>{void load();},[]);
 const topup=async()=>{if(!amount||amount<5000||amount>10000000||!Number.isInteger(amount)||amount%5000!==0){message.error("الشحن يبدأ من 5,000 دج وبمضاعفات 5,000 فقط");return;}setBusy(true);const r=await db.rpc("flexy_mini_demo_wallet_topup",{p_amount:amount});setBusy(false);if(r.error)message.error("فشل الشحن: "+r.error.message);else{setBalance(Number(r.data));setAmount(null);setOpen(false);message.success("تم تسجيل الشحن التجريبي");}};
 return <><Card bordered={false} style={{borderRadius:14,marginBottom:18,cursor:"pointer"}} onClick={()=>setOpen(true)} hoverable>
 <Space direction="vertical" style={{width:"100%"}}>
 <Typography.Text type="secondary">رصيدي · اضغط للشحن الذاتي</Typography.Text>
 <Typography.Title level={3} style={{margin:0,color:"#16a34a"}}>{balance===null?"—":balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" دج"}</Typography.Title>
 <Typography.Text type="secondary">محفظة الإدارة — رصيد تجريبي</Typography.Text>
 </Space></Card>
 <Modal title="شحن رصيدي" open={open} onCancel={()=>setOpen(false)} footer={null} destroyOnClose>
 <Space direction="vertical" style={{width:"100%"}} size="middle">
 <Typography.Text>الرصيد الحالي: {balance===null?"—":balance.toLocaleString("en-US")+" دج"}</Typography.Text>
 <InputNumber aria-label="مبلغ الشحن" min={5000} max={10000000} step={5000} precision={0} placeholder="5,000 أو 10,000 أو 15,000..." value={amount} onChange={setAmount} style={{width:"100%"}}/>
 {amount!==null&&amount>=5000&&amount%5000===0&&<Typography.Text strong>الرصيد بعد الشحن: {((balance??0)+amount).toLocaleString("en-US")} دج</Typography.Text>}
 <Alert type="info" showIcon message="أقل شحن 5,000 دج وبمضاعفات 5,000 فقط. شحن داخلي تجريبي."/>
 {error&&<Alert type="error" showIcon message={error}/>}
 <Button block type="primary" loading={busy} disabled={!amount||amount<5000||amount>10000000||!Number.isInteger(amount)||amount%5000!==0} onClick={()=>void topup()}>تأكيد الشحن</Button>
 </Space></Modal></>;
}