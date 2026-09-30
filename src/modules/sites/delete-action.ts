"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";

export async function deleteSiteHistory(form: FormData) {
 const input=z.object({id:z.uuid(),site:z.uuid(),confirmed:z.literal("yes")}).safeParse(Object.fromEntries(form));
 if(!input.success)return {error:"Revise a confirmação."};
 const {client}=await requireUser();
 const {error}=await client.rpc("delete_site_history",{p_id:input.data.id,p_site:input.data.site});
 if(error)return {error:error.message==="Site operation in progress" ? "Finalize ou cancele as operações e revogue as sessões do Designer antes de excluir." : "Não foi possível excluir o projeto. Confira seu acesso e a migration de exclusão."};
 revalidatePath("/dashboard","layout");
 return {error:null};
}
