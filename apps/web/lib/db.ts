import {PrismaClient} from "@prisma/client";
import {PrismaLibSQL} from "@prisma/adapter-libsql";
import {PrismaPg} from "@prisma/adapter-pg";
const globalDb=globalThis as typeof globalThis & {limitlessDb?:PrismaClient};
export function db(){
  const url=process.env.DATABASE_URL;
  if(!url)throw new Error("Missing database configuration");
  return globalDb.limitlessDb??=new PrismaClient({adapter:url.startsWith("file:")?new PrismaLibSQL({url}):new PrismaPg({connectionString:url})});
}
