import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {randomBytes,scrypt,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {db} from "./lib/db";
const hash=promisify(scrypt);
export const {handlers,auth}=NextAuth({
  providers:[Credentials({credentials:{email:{},password:{},register:{}},async authorize(c){
    const email=String(c.email??"").trim().toLowerCase(),password=String(c.password??"");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>256)return null;
    let u=await db().user.findUnique({where:{email}});
    if(c.register==="yes"){
      if(u)return null;
      const salt=randomBytes(16).toString("hex"),digest=await hash(password,salt,64) as Buffer;
      u=await db().user.create({data:{email,password:salt+"."+digest.toString("hex")}});
    }else{
      const [salt,expected]=(u?.password??"dummy.").split(".");
      const digest=await hash(password,salt,64) as Buffer;
      if(!u||!expected||!timingSafeEqual(digest,Buffer.from(expected,"hex")))return null;
    }
    return {id:u.id,email:u.email};
  }})],session:{strategy:"jwt"},callbacks:{session({session,token}){if(token.sub)session.user.id=token.sub;return session;}}
});
export async function owner(){
  if(process.env.SINGLE_USER==="true"){
    const email="local@localhost.invalid";
    return (await db().user.upsert({where:{email},create:{email,password:"disabled"},update:{}})).id;
  }
  return (await auth())?.user?.id;
}
