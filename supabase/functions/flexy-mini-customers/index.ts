import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const origin="https://amordz72.github.io";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const respond=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{...cors,"Content-Type":"application/json"}});
const enc=new TextEncoder();
async function sha256(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");}
function phone(value:string){const v=value.replace(/[^0-9]/g,"");return v.startsWith("213")?"0"+v.slice(3):v;}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return respond(405,{error:"Method not allowed"});
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!service||!anon)return respond(503,{error:"Server unavailable"});
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return respond(400,{error:"Invalid request"});}
 const action=String(body.action||"");
 if(action==="login"){
   const identifier=String(body.identifier||"").trim().toLowerCase(),password=String(body.password||""),credential=String(body.device_secret||"");
   if(!/^[0-9a-f]{64}$/.test(credential)||!password||password.length>128)return respond(401,{error:"بيانات الدخول غير صحيحة"});
   const isPhone=/^[+0-9 ()-]+$/.test(identifier);
   if(!isPhone&&!/^[a-z0-9_]{3,32}$/.test(identifier))return respond(401,{error:"بيانات الدخول غير صحيحة"});
   const {data:account}=await admin.from("flexy_mini_customer_accounts").select("id,party_id,username,active").eq(isPhone?"phone":"username",isPhone?phone(identifier):identifier).maybeSingle();
   if(!account?.active)return respond(401,{error:"بيانات الدخول غير صحيحة"});
   const {data:valid,error:verifyError}=await admin.rpc("flexy_mini_customer_check_login",{p_account_id:account.id,p_password:password});
   if(verifyError||valid!==true)return respond(401,{error:"بيانات الدخول غير صحيحة"});
   const credentialHash=await sha256(credential);
   const {data:existing,error:deviceError}=await admin.from("flexy_mini_trusted_devices").select("id,approved_at,revoked_at,expires_at").eq("customer_id",account.id).eq("credential_hash",credentialHash).maybeSingle();
   if(deviceError)return respond(503,{error:"تعذر فحص الجهاز"});
   if(!existing){
     const {error}=await admin.from("flexy_mini_trusted_devices").insert({customer_id:account.id,credential_hash:credentialHash,device_label:String(body.device_label||"متصفح").slice(0,80)});
     if(error&&error.code!=="23505")return respond(503,{error:"تعذر تسجيل طلب الجهاز"});
     return respond(423,{code:"DEVICE_PENDING",error:"تم تسجيل طلب اعتماد الجهاز. انتظر موافقة الإدارة"});
   }
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
   const {data:result,error}=await admin.rpc("flexy_mini_device_session",{p_customer_id:account.id,p_credential_hash:credentialHash,p_token_hash:await sha256(token)});
   if(error)return respond(503,{error:"تعذر إنشاء الجلسة"});
   if(!result?.allowed)return respond(423,{code:existing.revoked_at?"DEVICE_REVOKED":"DEVICE_PENDING",error:existing.revoked_at?"تم إلغاء اعتماد هذا الجهاز. تواصل مع الإدارة":"الجهاز ينتظر الاعتماد أو انتهت مدة ثقته. تواصل مع الإدارة"});
   // Record a successful customer login on the exact approved device, not on the account as a whole.
   if(existing.id){
     const {error:lastUsedError}=await admin.from("flexy_mini_trusted_devices").update({last_used_at:new Date().toISOString()}).eq("id",existing.id).eq("customer_id",account.id);
     if(lastUsedError)console.error("Failed to update trusted device last_used_at after login",lastUsedError);
   }
   return respond(200,{token,username:account.username,party_id:account.party_id});
 }
 if(action==="me"||action==="logout"){
   const token=String(body.token||"");
   if(!/^[0-9a-f]{64}$/.test(token))return respond(401,{error:"Unauthorized"});
   const hash=await sha256(token);
   const {data:session}=await admin.from("flexy_mini_customer_sessions").select("id,customer_id,device_id,expires_at,revoked_at").eq("token_hash",hash).maybeSingle();
   if(!session||session.revoked_at||new Date(session.expires_at).getTime()<Date.now())return respond(401,{error:"Unauthorized"});
   const {data:device}=await admin.from("flexy_mini_trusted_devices").select("id,customer_id,credential_hash,approved_at,revoked_at,expires_at").eq("id",session.device_id||0).maybeSingle();
   if(!device||device.customer_id!==session.customer_id||!device.approved_at||device.revoked_at||new Date(device.expires_at||new Date(new Date(device.approved_at).getTime()+7*86400000).toISOString()).getTime()<=Date.now()||device.credential_hash!==await sha256(String(body.device_secret||"")))return respond(401,{error:"الجهاز غير معتمد"});
   if(action==="logout"){await admin.from("flexy_mini_customer_sessions").update({revoked_at:new Date().toISOString()}).eq("id",session.id);return respond(200,{ok:true});}
   const {data:account}=await admin.from("flexy_mini_customer_accounts").select("username,phone,party_id,active,credit_enabled").eq("id",session.customer_id).maybeSingle();
   if(!account?.active)return respond(401,{error:"Unauthorized"});
   await admin.from("flexy_mini_trusted_devices").update({last_used_at:new Date().toISOString()}).eq("id",device.id);
   return respond(200,{username:account.username,phone:account.phone,party_id:account.party_id,credit_enabled:false});
 }
 const authorization=req.headers.get("authorization")||"";
 const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data:{user}}=await caller.auth.getUser();
 if(!user)return respond(401,{error:"Unauthorized"});
 const {data:isAdmin}=await caller.rpc("flexy_mini_is_admin");
 if(isAdmin!==true)return respond(403,{error:"Admin only"});
 if(action==="devices"){
   const {data,error}=await admin.from("flexy_mini_trusted_devices").select("id,customer_id,device_label,approved_at,revoked_at,expires_at,created_at,last_used_at,flexy_mini_customer_accounts(username,phone,party_id,money_party_directory(display_name))").order("created_at",{ascending:false}).limit(500);
   return error?respond(503,{error:"تعذر تحميل الأجهزة"}):respond(200,{devices:data});
 }
 if(action==="approve_device"||action==="revoke_device"){
   const id=Number(body.device_id);
   if(!Number.isSafeInteger(id)||id<1)return respond(400,{error:"جهاز غير صالح"});
   const {data,error}=await admin.rpc("flexy_mini_manage_device",{p_device_id:id,p_approve:action==="approve_device",p_mobile:body.device_kind==="mobile"});
   if(error)return respond(error.message.includes("MAX_TWO_TRUSTED_DEVICES")?409:503,{error:error.message.includes("MAX_TWO_TRUSTED_DEVICES")?"يوجد جهازان معتمدان. ألغ اعتماد أحدهما أولًا":"تعذر تحديث الجهاز"});
   return data?respond(200,{ok:true}):respond(404,{error:"الجهاز غير موجود"});
 }
 if(action==="list"){
   const {data,error}=await admin.from("flexy_mini_customer_accounts").select("id,party_id,username,phone,active,created_at").order("id",{ascending:false}).limit(100);
   return error?respond(503,{error:"List unavailable"}):respond(200,{customers:data});
 }
 if(action==="create"){
   const username=String(body.username||"").trim().toLowerCase(),normalized=phone(String(body.phone||"")),password=String(body.password||""),partyId=Number(body.party_id);
   if(!/^[a-z0-9_]{3,32}$/.test(username)||!/^0[567][0-9]{8}$/.test(normalized)||password.length<10||password.length>128||!Number.isSafeInteger(partyId)||partyId<1)return respond(400,{error:"Invalid customer details"});
   const {data:master}=await admin.from("money_party_directory").select("id").eq("id",partyId).eq("active",true).eq("is_canonical",true).eq("approval_status","approved").maybeSingle();
   if(!master)return respond(400,{error:"Master not eligible"});
   const {data:hash,error:hashError}=await admin.rpc("flexy_mini_customer_hash_password",{p_password:password});
   if(hashError||typeof hash!=="string")return respond(503,{error:"Password service unavailable"});
   const {data,error}=await admin.from("flexy_mini_customer_accounts").insert({party_id:partyId,username,phone:normalized,password_hash:hash,credit_enabled:false}).select("id,party_id,username,phone").single();
   if(error)return respond(error.code==="23505"?409:503,{error:error.code==="23505"?"Username, phone or Master already assigned":"Creation failed"});
   return respond(201,{customer:data});
 }
 return respond(400,{error:"Unknown action"});
});
