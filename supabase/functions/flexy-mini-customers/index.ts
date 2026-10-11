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
   return respond(423,{error:"Device approval required before customer login is enabled"});
 }
 if(action==="legacy_login_disabled"){
   const identifier=String(body.identifier||"").trim().toLowerCase();
   const password=String(body.password||"");
   if(!identifier||!password)return respond(401,{error:"Invalid credentials"});
   const normalized=phone(identifier);
   const {data:account}=await admin.from("flexy_mini_customer_accounts").select("id,party_id,username,phone,password_hash,active").or("username.eq."+identifier+",phone.eq."+normalized).limit(1).maybeSingle();
   if(!account||!account.active)return respond(401,{error:"Invalid credentials"});
   // Password verification is delegated to a restricted SQL function, never exposed in browser.
   const {data:valid,error:verifyError}=await admin.rpc("flexy_mini_customer_verify_password",{p_account_id:account.id,p_password:password});
   if(verifyError||valid!==true)return respond(401,{error:"Invalid credentials"});
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
   const {error:sessionError}=await admin.from("flexy_mini_customer_sessions").insert({customer_id:account.id,token_hash:await sha256(token),expires_at:new Date(Date.now()+12*60*60*1000).toISOString()});
   if(sessionError)return respond(503,{error:"Session unavailable"});
   return respond(200,{token,username:account.username,party_id:account.party_id});
 }
 if(action==="me"||action==="logout"){
   const token=String(body.token||"");
   if(!/^[0-9a-f]{64}$/.test(token))return respond(401,{error:"Unauthorized"});
   const hash=await sha256(token);
   const {data:session}=await admin.from("flexy_mini_customer_sessions").select("id,customer_id,expires_at,revoked_at").eq("token_hash",hash).maybeSingle();
   if(!session||session.revoked_at||new Date(session.expires_at).getTime()<Date.now())return respond(401,{error:"Unauthorized"});
   if(action==="logout"){await admin.from("flexy_mini_customer_sessions").update({revoked_at:new Date().toISOString()}).eq("id",session.id);return respond(200,{ok:true});}
   const {data:account}=await admin.from("flexy_mini_customer_accounts").select("username,phone,party_id,active,credit_enabled").eq("id",session.customer_id).maybeSingle();
   if(!account?.active)return respond(401,{error:"Unauthorized"});
   return respond(200,{username:account.username,phone:account.phone,party_id:account.party_id,credit_enabled:false});
 }
 const authorization=req.headers.get("authorization")||"";
 const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data:{user}}=await caller.auth.getUser();
 if(!user)return respond(401,{error:"Unauthorized"});
 const {data:isAdmin}=await caller.rpc("flexy_mini_is_admin");
 if(isAdmin!==true)return respond(403,{error:"Admin only"});
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
