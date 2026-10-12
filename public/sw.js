const CACHE="flexy-mini-shell-v2";const BASE="/flexy-mini/";const SHELL=BASE+"index.html";
self.addEventListener("install",event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith("flexy-mini-shell-")&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener("fetch",event=>{const req=event.request;const url=new URL(req.url);if(req.method!=="GET"||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
if(req.mode==="navigate"){event.respondWith((async()=>{try{const res=await fetch(req,{cache:"no-store"});if(res.ok){const cache=await caches.open(CACHE);await cache.put(SHELL,res.clone());}return res;}catch{const cached=await caches.match(SHELL);return cached||Response.error();}})());return;}
if(/\.(?:js|css)$/.test(url.pathname)){event.respondWith(fetch(req,{cache:"no-store"}).catch(()=>caches.match(req)));return;}
if(/\.(?:png|svg|webp|ico|woff2?)$/.test(url.pathname)){event.respondWith((async()=>{const hit=await caches.match(req);if(hit)return hit;const res=await fetch(req);if(res.ok){const cache=await caches.open(CACHE);await cache.put(req,res.clone());}return res;})());}
});