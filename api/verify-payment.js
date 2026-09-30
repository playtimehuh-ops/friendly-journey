import Stripe from "stripe";
import { getModel, ownerHash, tokenFromRequest, updateModel } from "../lib/store.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store"}})}

export default async function handler(request){
  if(request.method!=="POST")return json({error:"POST required."},405);
  try{
    const token=tokenFromRequest(request);
    if(!token)return json({error:"Account token required."},401);
    const body=await request.json();
    const modelId=String(body.modelId||"").trim();
    const sessionId=String(body.sessionId||"").trim();
    if(!modelId||!sessionId)return json({error:"Payment session is missing."},400);
    const owner=ownerHash(token);
    const model=await getModel(modelId,owner,false);
    if(!model)return json({error:"Model not found."},404);

    const key=process.env.STRIPE_SECRET_KEY;
    if(!key)return json({error:"STRIPE_SECRET_KEY is not configured."},500);
    const session=await new Stripe(key).checkout.sessions.retrieve(sessionId);
    if(session.status!=="complete"||session.payment_status!=="paid")return json({error:"Payment has not completed."},402);
    if(session.metadata?.modelId!==modelId||session.metadata?.ownerHash!==owner)return json({error:"Payment does not match this model."},403);

    await updateModel(modelId,{paid:true,active:true,subscription_id:String(session.subscription||"")});
    return json({ok:true});
  }catch(e){return json({error:e.message||"Payment verification failed."},500)}
}
