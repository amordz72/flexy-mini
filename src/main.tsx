import React from "react";
import { createRoot } from "react-dom/client";
import { Refine } from "@refinedev/core";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import routerProvider from "@refinedev/react-router";
import { createClient } from "@supabase/supabase-js";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import "./style.css";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const client = url && key ? createClient(url, key) : undefined;

function Home() {
  return <main><h1>Flexy Mini</h1><p>تجربة Refine مستقلة عن MyTool — لا توجد عمليات مالية مفعّلة.</p>
    <section><h2>الموارد القادمة</h2><ul><li>الشرائح والمودمات</li><li>مخزون البطاقات</li><li>طلبات الشحن</li><li>المحطات عبر Station Connect</li></ul></section>
    <p>{client ? "تم إعداد اتصال Supabase؛ لم يتم تفعيل الموارد أو الصلاحيات بعد." : "Supabase غير مهيأ. أضف متغيرات البيئة قبل اختبار البيانات."}</p>
    <p><Link to="/">الرئيسية</Link></p>
  </main>;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><BrowserRouter basename={import.meta.env.BASE_URL}>
    <Refine routerProvider={routerProvider} dataProvider={client ? dataProvider(client) : undefined} liveProvider={client ? liveProvider(client) : undefined}
      resources={[]} options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}>
      <Routes><Route path="/" element={<Home/>}/></Routes>
    </Refine>
  </BrowserRouter></React.StrictMode>
);
