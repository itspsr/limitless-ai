import type {Connection} from "@prisma/client";
import {openAICompatible} from "../../../packages/providers/src/index";
import {unseal} from "./crypto";
export function connectedAdapter(c:Connection,owner:string){
  const key=unseal(c.ciphertext,owner);
  if(c.provider!=="gemini"||!key.startsWith("google-refresh:"))return openAICompatible(c.base,key,c.model);
  return openAICompatible(c.base,"",c.model,async(url,init)=>{
    const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",signal:init?.signal,body:new URLSearchParams({grant_type:"refresh_token",client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,refresh_token:key.slice(15)})});
    if(!response.ok)return response;
    const {access_token}=await response.json();
    const headers=new Headers(init?.headers);headers.set("Authorization","Bearer "+access_token);headers.set("x-goog-user-project",process.env.GOOGLE_PROJECT_ID!);
    return fetch(url,{...init,headers});
  });
}
