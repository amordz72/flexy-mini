import React,{useEffect,useState} from "react";
import {Card,Button,InputNumber,Space,Typography,Alert,message} from "antd";
import type {SupabaseClient} from "@supabase/supabase-js";
export default function AdminWallet({db}:{db:SupabaseClient}){
 const [balance,setBalance]=useState<number|null>(null),[amount,setAmount]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=async()=>{setBusy(true);const r=await db.rpc("flexy_mini_demo_wallet_topup",{p_amount:0});setBusy(false);if(r.error)setError("تعذر تحميل المحفظة: "+r.error.message);else{setBalance(Number(r.data));setError("");}};
 useEffect(()=>{void load();},[]);
 const topup=async()=>{if(!amount||amount<=0||amount>10000000){message.error("أدخل مبلغًا صحيحًا");return;}setBusy(true);const r=await db.rpc("flexy_mini_demo_wallet_topup",{p_amount:amount});setBusy(false);if(r.error)message.error("فشل الشحن: "+r.error.message);else{setBalance(Number(r.data));setAmount(null);message.success("تم تسجيل الشحن التجريبي");}};
 return <Card bordered={false} style={{borderRadius:14,marginBottom:18}}><Space direction="vertical" style={{width:"100%"}}>
 <Typography.Text type="secondary">رصيد محفظة الإدارة</Typography.Text>
 <Typography.Title level={3} style={{margin:0,color:"#16a34a"}}>{balance===null?"—":balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" دج"}</Typography.Title>
 <Typography.Text type="secondary">رصيد تجريبي مستقل — لا يمثل أموالًا حقيقية ولا يشحن خطوط الهاتف</Typography.Text>
 {error&&<Alert type="error" showIcon message={error}/>}
 <Space wrap><InputNumber aria-label="مبلغ شحن المحفظة" min={0.01} max={10000000} precision={2} placeholder="مبلغ الشحن بالدينار" value={amount} onChange={setAmount} style={{width:190}}/><Button type="primary" loading={busy} onClick={()=>void topup()}>شحن المحفظة</Button></Space>
 </Space></Card>;
}