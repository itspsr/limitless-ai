import registry from "../../../packages/providers/providers.json";
import {db} from "./db";
export {registry};
export const minute=()=> new Date(Math.floor(Date.now()/60000)*60000);
export const today=()=>new Date(new Date().toISOString().slice(0,10)+"T00:00:00Z");
export async function state(owner:string){
  const [user,rows,conversations,activity]=await Promise.all([
    db().user.findUniqueOrThrow({where:{id:owner},select:{settings:true}}),
    db().connection.findMany({where:{owner},orderBy:[{priority:"asc"},{id:"asc"}],include:{usage:{where:{minute:{gte:today()}}}}}),
    db().conversation.findMany({where:{owner},orderBy:{updated:"desc"},include:{messages:{orderBy:[{created:"asc"},{id:"asc"}]}}}),
    db().activity.findMany({where:{owner,created:{gte:today()}},orderBy:{created:"desc"}})
  ]);
  const connections=rows.map(row=>({
    id:row.id,name:row.name,provider:row.provider,model:row.model,priority:row.priority,
    cooldown:row.cooldown,limits:JSON.parse(row.limits),headers:JSON.parse(row.headers),
    requests:row.usage.reduce((n,b)=>n+b.requests,0),tokens:row.usage.reduce((n,b)=>n+b.tokens,0),
    minuteRequests:row.usage.find(b=>+b.minute===+minute())?.requests??0,usage:row.usage
  }));
  return {registry,connections,conversations,activity,settings:{autoSwitch:true,warn:true,exhausted:"notify",...JSON.parse(user.settings)}};
}
