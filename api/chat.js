import { getModel } from "../lib/store.js";
import { generate } from "../lib/model-runtime.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store"}})}

export default async function handler(request){
  if(request.method!=="POST")return json({error:"POST required."},405);
  try{
    const body=await request.json();
    const modelId=String(body.modelId||"").trim();
    const prompt=String(body.prompt||"").trim();
    if(!modelId||!prompt)return json({error:"modelId and prompt are required."},400);
    if(prompt.length>8000)return json({error:"Message is too long."},400);

    const model=await getModel(modelId);
    if(!model||model.visibility!=="public"||!model.active||!model.paid){
      return json({error:"This model is not active."},403);
    }

    const packageData=model.package;
    const output=generate(packageData,prompt,{maxTokens:64,temperature:0.8,topK:20});
    return json({
      ok:true,
      model:{id:model.id,name:model.name,version:model.version},
      content:output
    });
  }catch(e){
    return json({error:e.message||"Model inference failed."},500);
  }
}
