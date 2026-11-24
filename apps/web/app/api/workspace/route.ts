import {randomUUID} from "node:crypto";
import {owner} from "../../../auth";
import {db} from "../../../lib/db";
import {seal} from "../../../lib/crypto";
import {state,registry} from "../../../lib/state";
import {connectedAdapter} from "../../../lib/adapter";
export async function GET(){const id=await owner();return id?Response.json(await state(id),{headers:{"Cache-Control":"no-store"}}):new Response(null,{status:401});}
export async function POST(req:Request){
  if(req.headers.get("origin")!==new URL(req.url).origin)return new Response(null,{status:403});
  const uid=await owner();if(!uid)return new Response(null,{status:401});
  try{
    const b=await req.json(), id=String(b.id??""), where={id,owner:uid};
    switch(b.action){
      case "connect":{
        const entry=registry.find(p=>p.id===b.provider);
        const base=entry?.base.replace("{account_id}",/^[a-f0-9]{32}$/.test(b.account)?b.account:"INVALID")??String(b.base);
        const url=new URL(base);
        if(!entry && !process.env.CUSTOM_PROVIDER_HOSTS?.split(",").map(s=>s.trim()).includes(url.host))throw Error();
        if(!b.key||!b.model||url.protocol!=="https:"||base.includes("INVALID"))throw Error();
        const provider=entry?.id??"custom-"+randomUUID();
        const data={name:entry?.name??String(b.name),base,model:String(b.model),ciphertext:seal(String(b.key),uid),limits:JSON.stringify(entry?.limits??{})};
        await db().connection.upsert({where:{owner_provider:{owner:uid,provider}},create:{...data,owner:uid,provider,priority:await db().connection.count({where:{owner:uid}})},update:data});break;
      }
      case "test":{
        const c=await db().connection.findFirstOrThrow({where});
        await connectedAdapter(c,uid).chat([{role:"user",content:"Reply OK."}],AbortSignal.timeout(15000));break;
      }
      case "disconnect":await db().connection.deleteMany({where});break;
      case "edit":{
        const limits:Record<string,number|null>={};
        for(const k of ["rpm","rpd","tokensDay","context"]){const n=b.limits?.[k];if(n!=null&&(!Number.isSafeInteger(n)||n<1))throw Error();limits[k]=n??null;}
        await db().connection.updateMany({where,data:{model:String(b.model),limits:JSON.stringify(limits)}});break;
      }
      case "order":{
        if(!Array.isArray(b.ids)||b.ids.length>100)throw Error();
        await db().$transaction(b.ids.map((v:string,priority:number)=>db().connection.updateMany({where:{id:v,owner:uid},data:{priority}})));break;
      }
      case "settings":await db().user.update({where:{id:uid},data:{settings:JSON.stringify({autoSwitch:b.autoSwitch===true,warn:b.warn===true,exhausted:b.exhausted==="stop"?"stop":"notify"})}});break;
      case "pin":await db().message.updateMany({where:{id,conversation:{owner:uid}},data:{pinned:b.pinned===true}});break;
      default:throw Error();
    }
    return Response.json({ok:true});
  }catch{return Response.json({error:"Request failed. Check the provider settings."},{status:400});}
}
