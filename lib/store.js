import { createHash } from "node:crypto";

function env(name){
  const v=process.env[name];
  if(!v) throw new Error(name+" is not configured.");
  return v;
}
function base(){return env("SUPABASE_URL").replace(/\/$/,"")+"/rest/v1/modeldock_models";}
function headers(extra={}){
  const key=env("SUPABASE_SERVICE_ROLE_KEY");
  return {apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",...extra};
}
export function ownerHash(token){
  return createHash("sha256").update(String(token)).digest("hex");
}
export function tokenFromRequest(request){
  const h=request.headers.get("authorization")||"";
  return /^Bearer\s+cb_[A-Za-z0-9_-]{40,80}$/i.test(h)?h.slice(7).trim():"";
}
export async function listOwnerModels(owner){
  const r=await fetch(base()+"?owner_hash=eq."+encodeURIComponent(owner)+"&select=id,name,version,info,visibility,price,active,paid,params,created_at,updated_at&order=created_at.desc",{headers:headers()});
  const t=await r.text();if(!r.ok)throw new Error(t||"Model store request failed.");
  return t?JSON.parse(t):[];
}
export async function getModel(id,owner=null,includePackage=false){
  const parts=["id=eq."+encodeURIComponent(id)];
  if(owner)parts.push("owner_hash=eq."+encodeURIComponent(owner));
  const select=includePackage?"*":"id,owner_hash,name,version,info,visibility,price,active,paid,params,created_at,updated_at";
  const r=await fetch(base()+"?"+parts.join("&")+"&select="+select,{headers:headers()});
  const t=await r.text();if(!r.ok)throw new Error(t||"Model store request failed.");
  const rows=t?JSON.parse(t):[];
  return rows[0]||null;
}
export async function upsertModel(model){
  const r=await fetch(base(),{method:"POST",headers:headers({Prefer:"resolution=merge-duplicates,return=representation"}),body:JSON.stringify(model)});
  const t=await r.text();if(!r.ok)throw new Error(t||"Model store write failed.");
  const rows=t?JSON.parse(t):[];
  return rows[0]||model;
}
export async function updateModel(id,patch){
  const r=await fetch(base()+"?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:headers({Prefer:"return=representation"}),body:JSON.stringify(patch)});
  const t=await r.text();if(!r.ok)throw new Error(t||"Model store update failed.");
  const rows=t?JSON.parse(t):[];
  return rows[0]||null;
}
export async function deleteModel(id,owner){
  const r=await fetch(base()+"?id=eq."+encodeURIComponent(id)+"&owner_hash=eq."+encodeURIComponent(owner),{method:"DELETE",headers:headers({Prefer:"return=minimal"})});
  if(!r.ok)throw new Error((await r.text())||"Model delete failed.");
}
