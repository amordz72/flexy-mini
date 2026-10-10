import React from "react";
import { createRoot } from "react-dom/client";
import { Refine } from "@refinedev/core";
import { BrowserRouter, Route, Routes } from "react-router";
import routerProvider from "@refinedev/react-router";
import { createClient } from "@supabase/supabase-js";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import "./style.css";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const client = url && key ? createClient(url, key) : undefined;

function Home() {
  return (
    <main className="welcome">
      <div className="mark">⚡</div>
      <p className="eyebrow">FLEXY MINI · REFINE</p>
      <h1>فليكسي ميني</h1>
      <p className="lead">النسخة التجريبية للمشروع جاهزة للعرض.</p>
      <div className="status"><span className="dot" /> تم تحميل واجهة التطبيق بنجاح</div>
      <p className="note">هذه صفحة اختبار النشر فقط. لا توجد عمليات شحن أو معاملات مالية مفعّلة.</p>
      <p className="connection">{client ? "إعدادات الاتصال بـ Supabase متوفرة، ولم يتم اختبار الاتصال بعد." : "ربط Supabase لم يُضبط بعد."}</p>
      <footer>Flexy Mini · v0.1.0</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Refine
        routerProvider={routerProvider}
        dataProvider={client ? dataProvider(client) : undefined}
        liveProvider={client ? liveProvider(client) : undefined}
        resources={[]}
        options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
      >
        <Routes><Route path="/" element={<Home />} /></Routes>
      </Refine>
    </BrowserRouter>
  </React.StrictMode>
);
