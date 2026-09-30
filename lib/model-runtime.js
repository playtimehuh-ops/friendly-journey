function flat(x){
  if(x==null)return null;
  if(Array.isArray(x))return Float32Array.from(x.flat(Infinity).map(Number));
  if(Array.isArray(x.data))return Float32Array.from(x.data.flat(Infinity).map(Number));
  return null;
}
function pick(o,paths){
  for(const p of paths){let v=o;for(const k of p.split("."))v=v?.[k];if(v!=null)return v}
  return null;
}
function makeVocab(pkg){
  const t=pkg?.model?.tokenizer||pkg?.tokenizer||{};
  let ids=t.idToToken||t.id_to_token||t.tokens;
  if(!ids&&t.vocab){ids=[];for(const [k,v] of Object.entries(t.vocab))ids[Number(v)]=k}
  if(!ids?.length)throw new Error("Tokenizer vocabulary is missing.");
  const map=new Map(ids.map((x,i)=>[String(x),i]));
  return {idToToken:ids,map,unk:Number(t.unkId??t.unk_id??0),bos:t.bosId??t.bos_id,eos:t.eosId??t.eos_id};
}
function inspectPackage(pkg){
  const m=pkg?.model&&typeof pkg.model==="object"?pkg.model:pkg;
  const cfg=m.config||pkg.config||{};
  const tok=m.tokenizer||pkg.tokenizer||{};
  const w=m.weights||m.parameters||pkg.weights||pkg.parameters;
  if(!w)throw new Error("Learned weight tensors are missing.");
  const c={
    architecture:String(cfg.architecture||m.architecture||"transformer").toLowerCase(),
    vocab:Number(cfg.vocabSize||cfg.vocab_size||tok.vocabSize||Object.keys(tok.vocab||{}).length||0),
    dim:Number(cfg.dim||cfg.hiddenSize||cfg.hidden_size||cfg.dModel||cfg.d_model||0),
    heads:Number(cfg.heads||cfg.numHeads||cfg.num_heads||cfg.numAttentionHeads||cfg.num_attention_heads||0),
    layers:Number(cfg.layers||cfg.numLayers||cfg.num_layers||0),
    maxSeq:Number(cfg.maxSeqLen||cfg.max_seq_len||cfg.contextLength||cfg.context_length||128),
    activation:String(cfg.activation||"gelu").toLowerCase(),
    rms:Boolean(cfg.rmsnorm||cfg.rmsNorm||cfg.normType==="rms")
  };
  const emb=flat(pick(w,["tokenEmbedding","token_embedding","wte","tok_embeddings","embedding","embeddings.token"]));
  const layers=w.layers||w.transformer?.layers||w.blocks||m.layers||[];
  if(!c.architecture.includes("transformer")&&!c.architecture.includes("gpt"))throw new Error("Unsupported model architecture: "+c.architecture);
  if(!emb||!c.dim||!c.heads||!c.layers||layers.length<c.layers)throw new Error("Transformer config or learned layer weights are incomplete.");
  return {pkg,m,w,c,emb,pos:flat(pick(w,["positionEmbedding","position_embedding","wpe","pos_embeddings"])),layers,norm:pick(w,["finalNorm","final_norm","norm","ln_f"]),out:pick(w,["lmHead","lm_head","output","head"]),v:makeVocab(pkg)};
}
function vec(x,w,rows,cols){
  const o=new Float32Array(rows);
  for(let r=0;r<rows;r++){let s=0,b=r*cols;for(let k=0;k<cols;k++)s+=x[k]*(w[b+k]||0);o[r]=s}
  return o;
}
function norm(x,g,b,rms){
  let mean=0;if(!rms)for(const z of x)mean+=z;mean/=x.length;
  let ss=0;for(const z of x){const q=rms?z:z-mean;ss+=q*q}
  const inv=1/Math.sqrt(ss/x.length+1e-5),o=new Float32Array(x.length);
  for(let i=0;i<x.length;i++){const q=rms?x[i]:x[i]-mean;o[i]=q*inv*(g?.[i]??1)+(b?.[i]??0)}
  return o;
}
function layer(x){
  return {
    g:flat(pick(x,["norm1.gamma","norm1.weight","ln1.gamma","ln_1.weight","input_norm.weight"])),
    b:flat(pick(x,["norm1.beta","norm1.bias","ln1.beta","ln_1.bias","input_norm.bias"])),
    q:flat(pick(x,["q.weight","q_proj.weight","attention.q.weight","query.weight"])),
    k:flat(pick(x,["k.weight","k_proj.weight","attention.k.weight","key.weight"])),
    v:flat(pick(x,["v.weight","v_proj.weight","attention.v.weight","value.weight"])),
    o:flat(pick(x,["o.weight","o_proj.weight","attention.o.weight","out.weight"])),
    g2:flat(pick(x,["norm2.gamma","norm2.weight","ln2.gamma","ln_2.weight","post_attention_norm.weight"])),
    b2:flat(pick(x,["norm2.beta","norm2.bias","ln2.beta","ln_2.bias","post_attention_norm.bias"])),
    up:flat(pick(x,["ff.up.weight","mlp.up.weight","ffn.up.weight","w1.weight","fc1.weight","ff1.weight"])),
    gate:flat(pick(x,["ff.gate.weight","mlp.gate.weight","ffn.gate.weight","gate.weight"])),
    down:flat(pick(x,["ff.down.weight","mlp.down.weight","ffn.down.weight","w2.weight","fc2.weight","ff2.weight"]))
  };
}
export function generate(pkg,prompt,{maxTokens=64,temperature=.8,topK=20}={}){
  const m=inspectPackage(pkg),v=m.v;
  const ids=[];for(let i=0;i<prompt.length;){
    let best=null,id=v.unk;
    for(const [tok,tid] of v.map)if(tok&&prompt.startsWith(tok,i)&&(best==null||tok.length>best.length)){best=tok;id=tid}
    ids.push(id);i+=best?best.length:1;
  }
  if(!ids.length&&v.bos!=null)ids.push(Number(v.bos));
  const start=ids.length;
  const limit=Math.min(Number(maxTokens)||64,128);
  for(let step=0;step<limit;step++){
    const ctx=ids.slice(-m.c.maxSeq),c=m.c,d=c.dim,h=Math.max(1,c.heads),hd=Math.floor(d/h);
    let x=ctx.map((id,p)=>{const z=new Float32Array(d),base=id*d;for(let j=0;j<d;j++)z[j]=m.emb[base+j]||0;if(m.pos){const pb=p*d;for(let j=0;j<d;j++)z[j]+=m.pos[pb+j]||0}return z});
    for(let li=0;li<c.layers;li++){
      const L=layer(m.layers[li]);
      if(!L.q||!L.k||!L.v||!L.o||!L.up||!L.down)throw new Error("Layer "+li+" is missing required weights.");
      for(let t=0;t<x.length;t++){
        const n=norm(x[t],L.g,L.b,c.rms),qq=vec(n,L.q,d,d),att=new Float32Array(d),scores=new Float32Array(t+1);
        let mx=-Infinity;
        for(let j=0;j<=t;j++){const nk=norm(x[j],L.g,L.b,c.rms),kk=vec(nk,L.k,d,d);let s=0;for(let i=0;i<d;i++)s+=qq[i]*kk[i];scores[j]=s/Math.sqrt(hd);if(scores[j]>mx)mx=scores[j]}
        let sum=0;for(let j=0;j<=t;j++){scores[j]=Math.exp(scores[j]-mx);sum+=scores[j]}
        for(let j=0;j<=t;j++){const nv=norm(x[j],L.g,L.b,c.rms),vv=vec(nv,L.v,d,d),p=scores[j]/sum;for(let i=0;i<d;i++)att[i]+=p*vv[i]}
        const ao=vec(att,L.o,d,d),y=new Float32Array(d);for(let i=0;i<d;i++)y[i]=x[t][i]+ao[i];
        const n2=norm(y,L.g2,L.b2,c.rms),up=vec(n2,L.up,L.up.length/d,d),ff=new Float32Array(up.length);
        for(let i=0;i<up.length;i++){const z=up[i];ff[i]=c.activation.includes("silu")?z/(1+Math.exp(-z)):.5*z*(1+Math.tanh(Math.sqrt(2/Math.PI)*(z+.044715*z*z*z)))}
        if(L.gate){const g=vec(n2,L.gate,L.gate.length/d,d);for(let i=0;i<ff.length;i++){const z=g[i];ff[i]=(z/(1+Math.exp(-z)))*up[i]}}
        const dn=vec(ff,L.down,d,ff.length),out=new Float32Array(d);for(let i=0;i<d;i++)out[i]=y[i]+dn[i];x[t]=out;
      }
    }
    const last=norm(x[x.length-1],flat(pick(m.norm,["gamma","weight","scale"])),flat(pick(m.norm,["beta","bias"])),c.rms);
    let W=flat(pick(m.out,["weight"]));if(!W)W=m.emb;
    const logits=vec(last,W,c.vocab,d),bias=flat(pick(m.out,["bias"]));if(bias)for(let i=0;i<logits.length;i++)logits[i]+=bias[i]||0;
    const items=Array.from(logits,(z,i)=>({z:z/Math.max(.05,temperature),i})).sort((a,b)=>b.z-a.z).slice(0,Math.max(1,topK));
    const peak=items[0].z;let total=0;for(const z of items){z.p=Math.exp(z.z-peak);total+=z.p}
    let r=Math.random()*total,next=items[items.length-1].i;for(const z of items){r-=z.p;if(r<=0){next=z.i;break}}
    ids.push(next);if(v.eos!=null&&next===Number(v.eos))break;
  }
  return decode(ids.slice(start),v);
}
function decode(ids,v){return ids.map(id=>v.idToToken[id]??"").join("")}
export { inspectPackage };
