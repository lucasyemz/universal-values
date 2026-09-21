"use server";
import { cookies } from "next/headers";
import { z } from "zod";
export async function setProductLanguage(value: unknown) {
  const locale=z.enum(["en","pt-BR"]).parse(value);
  (await cookies()).set("copyreplace-locale",locale,{path:"/",maxAge:60*60*24*365,sameSite:"lax",httpOnly:true,secure:process.env.NODE_ENV==="production"});
}
