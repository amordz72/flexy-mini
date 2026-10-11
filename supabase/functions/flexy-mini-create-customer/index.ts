// Admin-only customer provisioning. Deploy to Supabase Edge Functions after security review.
// Do not place SUPABASE_SERVICE_ROLE_KEY in Vite/browser environment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async (req) => {
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  if(req.method!=="POST") return reply(405,{error:"Method not allowed"});
  const jwt=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!jwt) return reply(401,{error:"Unauthorized"});
  const base=Deno.env.get("SUPABASE_URL")!, pub=Deno.env.get("SUPABASE_ANON_KEY")!, secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller=createClient(base,pub,{global:{headers:{Authorization:"Bearer "+jwt}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await caller.auth.getUser();
  if(authError||!user) return reply(401,{error:"Unauthorized"});
  const {data:isAdmin,error:roleError}=await caller.rpc("flexy_mini_is_admin");
  if(roleError||isAdmin!==true) return reply(403,{error:"Admin only"});
  let payload: unknown;
  try {payload=await req.json();}catch{return reply(400,{error:"Invalid JSON"});}
  const obj=payload as Record<string,unknown>;
  const username=String(obj?.username||"").trim().toLowerCase();
  const password=String(obj?.password||"");
  if(!/^[a-z0-9_]{3,32}$/.test(username)) return reply(400,{error:"Username must be 3-32 Latin letters, numbers or underscore"});
  if(password.length<10||password.length>128) return reply(400,{error:"Password must be 10-128 characters"});
  const admin=createClient(base,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const email=username+"@users.flexy-mini.invalid";
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{flexy_mini_customer:true}});
  if(created.error||!created.data.user) return reply(409,{error:created.error?.message||"Account creation failed"});
  const id=created.data.user.id;
  const linked=await admin.from("flexy_mini_credit_accounts").insert({user_id:id,enabled:false,credit_limit:0,debt:0,wallet_balance:0});
  if(linked.error) {
    await admin.auth.admin.deleteUser(id);
    return reply(500,{error:"Customer access setup failed; account creation rolled back"});
  }
  return reply(201,{username,user_id:id,enabled:false});
});
