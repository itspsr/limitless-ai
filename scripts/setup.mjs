import {existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
const web=fileURLToPath(new URL("../apps/web/",import.meta.url));
const data=path.join(web,"data");
mkdirSync(data,{recursive:true,mode:0o700});
const config=path.join(data,".env");
if(!existsSync(config)){
  const secret=()=>randomBytes(32).toString("hex");
  try {writeFileSync(config,"AUTH_SECRET="+secret()+"\nENCRYPTION_SECRET="+secret()+"\n",{flag:"wx",mode:0o600});}
  catch(error){if(error.code!=="EEXIST")throw error;}
}
for(const file of [path.join(web,"../../.env"),config]) if(existsSync(file)) process.loadEnvFile(file);
process.env.DATABASE_URL??="file:"+path.join(data,"limitless.db");
if(process.env.DATABASE_URL.startsWith("file:")){const filename=path.resolve(web,process.env.DATABASE_URL.slice(5));mkdirSync(path.dirname(filename),{recursive:true});writeFileSync(filename,"",{flag:"a",mode:0o600});process.env.DATABASE_URL="file:"+filename;}
const postgres=/^postgres(ql)?:/.test(process.env.DATABASE_URL);
const schema=path.join(web,"prisma/runtime.prisma");
writeFileSync(schema,readFileSync(path.join(web,"prisma/schema.prisma"),"utf8").replace('provider = "sqlite"','provider = "'+(postgres?"postgresql":"sqlite")+'"'));
function run(args){const result=spawnSync("pnpm",args,{cwd:web,env:process.env,stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);}
run(["exec","prisma","generate","--schema",schema]);
run(["exec","prisma","db","push","--skip-generate","--schema",schema]);
if(process.argv[2])run(["exec","next",process.argv[2],...process.argv.slice(3)]);
