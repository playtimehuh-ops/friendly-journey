import Stripe from "stripe";
import { getModel, ownerHash, tokenFromRequest } from "../lib/store.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store"}})}
function stripe(){const key=process.env.STRIPE_SECRET_KEY;if(!key)throw new Error("STRIPE_SECRET_KEY is not configured.");return new Stripe(key)}

export default async function handler(request){
  if(request.method!=="POST")return json({error:"POST required."},405);
  try{
    const token=tokenFromRequest(request);
    if(!token)return json({error:"Account token required."},401);
    const body=await request.json(),id=String(body.modelId||"").trim(),owner=ownerHash(token);
    const model=await getModel(id,owner,true);
    if(!model)return json({error:"Model not found."},404);

    const amount=Math.round(Math.max(0,Number(model.price)||0)*100);
    if(amount<50)return json({error:"Price must be at least $0.50/month."},400);

    const s=stripe(),origin=new URL(request.url).origin;
    const session=await s.checkout.sessions.create({
      mode:"subscription",
      line_items:[{
        price_data:{
          currency:"usd",
          unit_amount:amount,
          recurring:{interval:"month"},
          product_data:{name:"ModelDock — "+model.name}
        },
        quantity:1
      }],
      client_reference_id:model.id,
      metadata:{modelId:model.id,ownerHash:owner},
      subscription_data:{metadata:{modelId:model.id,ownerHash:owner}},
      success_url:origin+"/?payment=success&modelId="+encodeURIComponent(model.id),
      cancel_url:origin+"/?payment=cancelled"
    });
    return json({ok:true,url:session.url});
  }catch(e){return json({error:e.message||"Checkout failed."},500)}
}
