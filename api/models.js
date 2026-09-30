import { randomUUID } from "node:crypto";
import { deleteModel, getModel, listOwnerModels, ownerHash, tokenFromRequest, upsertModel } from "../lib/store.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store"}})}
export default async function handler(request){
  try{
    if(request.method==="GET"){
      const id=new URL(request.url).searchParams.get("id");
      const scope=new URL(request.url).searchParams.get("scope")||"owner";
      if(!id){
        const token=tokenFromRequest(request);if(!token)return json({error:"Account token required."},401);
        return json({models:await listOwnerModels(ownerHash(token))});
      }
      if(scope==="public"){
        const model=await getModel(id);
        if(!model||model.visibility!=="public"||!model.active||!model.paid)return json({error:"Model is not publicly available."},404);
        return json({model});
      }
      const token=tokenFromRequest(request);if(!token)return json({error:"Account token required."},401);
      const model=await getModel(id,ownerHash(token),true);
      if(!model)return json({error:"Model not found."},404);
      return json({model});
    }
    if(request.method!=="POST")return json({error:"POST required."},405);
    const token=tokenFromRequest(request);if(!token)return json({error:"Account token required."},401);
    const owner=ownerHash(token);
    const body=await request.json();
    if(body.action==="save"){
      const model=body.model||{};if(!model.package) return json({error:"Trained model package is required."},400);
      const id=String(model.id||randomUUID());
      const clean={
        id,owner_hash:owner,name:String(model.name||"Unnamed AI").slice(0,120),
        version:String(model.version||"1.0.0").slice(0,40),info:String(model.info||"").slice(0,2000),
        visibility:model.visibility==="public"?"public":"private",
        price:Math.max(0,Number(model.price)||0),active:Boolean(model.active),paid:Boolean(model.paid),
        params:Math.max(0,Math.floor(Number(model.params)||0)),package:model.package
      };
      const saved=await upsertModel(clean);
      return json({ok:true,model:saved});
    }
    if(body.action==="delete"){
      const id=String(body.modelId||"");if(!id)return json({error:"Model id required."},400);
      await deleteModel(id,owner);return json({ok:true});
    }
    return json({error:"Unknown action."},400);
  }catch(e){return json({error:e.message||"Model service failed."},500)}
}
