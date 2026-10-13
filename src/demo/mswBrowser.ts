import {http, HttpResponse} from "msw";
import {setupWorker} from "msw/browser";
import {demoDb} from "./mockDb";

/**
 * All browser RPC requests stay on the LAB's own origin under a reserved mock-only path.
 * No real Supabase URL / key / auth token / production fallback is constructed here.
 * The worker MUST start before the React page mounts.
 */
const prefix = `${import.meta.env.BASE_URL}__lab_only__/rpc/`;
const handlers = [
  http.post(`*${prefix}:name`, async ({request,params}) => {
    const payload = await request.json().catch(()=>null);
    if(!payload || typeof payload!=="object" || Array.isArray(payload)) {
      return HttpResponse.json({data:null,error:{message:"طلب محاكاة غير صالح"}});
    }
    const result = await demoDb.rpc(String(params.name),payload as Record<string,unknown>);
    return HttpResponse.json(result,{headers:{"Cache-Control":"no-store"}});
  })
];
const worker = setupWorker(...handlers);

export async function enableLabMocking():Promise<void>{
  if (!window.location.pathname.endsWith("/demo.html")) {
    throw new Error("رفض المحاكاة خارج صفحة المختبر المستقلة");
  }
  if (!("serviceWorker" in navigator)) {
    throw new Error("المتصفح لا يدعم Service Worker للمحاكاة");
  }
  await worker.start({
    serviceWorker:{
      url:`${import.meta.env.BASE_URL}mockServiceWorker.js`,
      options:{scope:import.meta.env.BASE_URL}
    },
    quiet:true,
    onUnhandledRequest(request,print) {
      // Other network calls are a configuration error; refuse to proceed on the lab.
      print.error();
      throw new Error("طلب خارج خدمات المحاكاة: "+request.url);
    }
  });
}

export const demoMswClient={
  async rpc(name:string,args:Record<string,unknown>={}):Promise<{data:any;error:any}>{
    try{
      const response=await fetch(prefix+encodeURIComponent(name),{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(args),
        credentials:"omit",
        cache:"no-store"
      });
      if(!response.ok)throw Error("HTTP "+response.status);
      const result=await response.json();
      if(!result || typeof result!=="object" || !("data" in result) || !("error" in result))
        throw Error("الرد ليس من خادم المحاكاة");
      return result;
    }catch(error){
      // A failed worker NEVER falls back to Supabase or a physical station.
      return {data:null,error:{message:"تعذر الوصول لمحرك المحاكاة المعزول: "+
        (error instanceof Error?error.message:String(error))}};
    }
  }
};
