// Avoid intercepting navigation or versioned JS/CSS requests.
// GitHub Pages can briefly serve HTML referring to assets from a prior deployment.
// The browser should own normal HTTP caching and retries; the worker caches only images.
const BASE="/flexy-mini/";
const CACHE="flexy-mini-images-v4";
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith("flexy-mini-")&&key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener("fetch",event=>{
 const req=event.request;
 const url=new URL(req.url);
 if(req.method!=="GET"||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
 if(req.mode==="navigate"||/\.(?:js|css)$/.test(url.pathname))return;
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
