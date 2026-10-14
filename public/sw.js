// Navigation is network-first. Never pair a cached HTML shell with a different deploy's JS chunks.
const BASE="/flexy-mini/";
const CACHE="flexy-mini-static-v3";
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith("flexy-mini-shell-")||key.startsWith("flexy-mini-static-")).filter(key=>key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener("fetch",event=>{
 const req=event.request;
 const url=new URL(req.url);
 if(req.method!=="GET"||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
 if(req.mode==="navigate"){
  // An outdated HTML document is worse than an explicit offline error: it references missing chunks.
  event.respondWith(fetch(req,{cache:"no-store"}).catch(()=>new Response(
   '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:18px sans-serif;padding:24px"><h2>لا يمكن تحميل فليكسي ميني</h2><p>تحقق من الاتصال بالإنترنت ثم أعد المحاولة. لم يتم حذف بياناتك.</p><button onclick="location.reload()">إعادة المحاولة</button></body></html>',
   {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}
  )));
  return;
 }
 if(/\.(?:js|css)$/.test(url.pathname)){
  // Never serve a stale chunk after deployment, and never cache an HTML 404 as JS.
  event.respondWith(fetch(req,{cache:"no-store"}));
  return;
 }
 if(/\.(?:png|svg|webp|ico|woff2?)$/.test(url.pathname)){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   const hit=await cache.match(req);
   if(hit)return hit;
   const response=await fetch(req);
   if(response.ok)await cache.put(req,response.clone());
   return response;
  })());
 }
});
