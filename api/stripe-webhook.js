import Stripe from "stripe";
import { updateModel } from "../lib/store.js";

export const config={api:{bodyParser:false}};

export default async function handler(request){
  if(request.method!=="POST")return new Response("POST required.",{status:405});
  try{
    const key=process.env.STRIPE_SECRET_KEY;
    const secret=process.env.STRIPE_WEBHOOK_SECRET;
    if(!key||!secret)return new Response("Stripe webhook is not configured.",{status:500});
    const signature=request.headers.get("stripe-signature");
    if(!signature)return new Response("Missing signature.",{status:400});
    const raw=await request.text();
    const event=new Stripe(key).webhooks.constructEvent(raw,signature,secret);
    const obj=event.data.object||{};
    const metadata=obj.metadata||{};
    const modelId=metadata.modelId;
    if(modelId){
      if(["checkout.session.completed","invoice.paid","customer.subscription.created","customer.subscription.updated"].includes(event.type)){
        await updateModel(modelId,{paid:true,active:true,subscription_id:String(obj.subscription||obj.id||"")});
      }
      if(["invoice.payment_failed","customer.subscription.deleted"].includes(event.type)){
        await updateModel(modelId,{paid:false,active:false});
      }
    }
    return Response.json({received:true});
  }catch(e){return new Response(e.message||"Webhook error.",{status:400})}
}
