"use server";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
const schema = z.object({ used:z.number().int().nonnegative(),limit:z.number().int().positive(),remaining:z.number().int().nonnegative(),resetsAt:z.string().datetime({offset:true}),intervalSeconds:z.number().int().nonnegative(),availableAt:z.string().datetime({offset:true}),connected:z.boolean() });
export async function getGeminiUsage() {
  const {client} = await requireUser();
  const {data,error} = await client.rpc("gemini_usage_status", {});
  if(error) return {ok:false as const,message:"Não foi possível carregar o consumo Gemini. Verifique a migration de consumo e tente atualizar."};
  const parsed=schema.safeParse(data);
  if(!parsed.success) return {ok:false as const,message:"Não foi possível carregar o consumo Gemini. Tente atualizar."};
  return {ok:true as const,usage:parsed.data};
}
