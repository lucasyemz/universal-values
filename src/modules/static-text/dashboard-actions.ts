"use server";
import { createHash, createHmac } from "node:crypto";
import { getWebflowConfig } from "@/connectors/webflow/config";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { designerSite } from "./dashboard-service";

export async function authorizeDesigner(_previous: { code?: string; error?: string }, form: FormData): Promise<{ code?: string; error?: string }> {
  const input = z.object({ id: z.uuid(), siteId: z.uuid(), confirmed: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Revise o acesso e marque a confirmação." };
  const { client } = await designerSite(input.data.siteId);
  const config = getWebflowConfig();
  if (!config) return { error: "Integração indisponível." };
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { error: "Entre novamente." };
  const code = "uvd_" + createHmac("sha256", Buffer.from(config.encryptionKey, "hex")).update(["designer-capability-v1", auth.user.id, input.data.siteId, input.data.id].join(":")).digest("hex");
  const result = await client.rpc("authorize_designer_session", { p_id: input.data.id, p_site_id: input.data.siteId, p_token_hash: createHash("sha256").update(code).digest("hex") });
  if (result.error) return { error: "Não foi possível autorizar. Confira a migration 009; recarregue a página para tentar novamente." };
  revalidatePath("/dashboard", "layout");
  return { code };
}
export async function revokeDesigner(form: FormData) {
  const input = z.object({ id: z.uuid(), siteId: z.uuid(), confirmed: z.literal("on") }).parse(Object.fromEntries(form));
  const { client } = await designerSite(input.siteId);
  const result = await client.rpc("revoke_designer_session", { p_id: input.id });
  if (result.error) throw new Error("Não foi possível revogar a sessão.");
  revalidatePath("/dashboard/sites/" + input.siteId + "/static");
}

export async function revokeDesignerAccess(form: FormData) {
 const input = z.object({siteId:z.uuid(), sessions:z.array(z.uuid()).min(1).max(1000),confirmed:z.literal("yes")}).parse({siteId:form.get("siteId"),sessions:form.getAll("session"),confirmed:form.get("confirmed")});
 const {client}=await designerSite(input.siteId);
 const result=await client.rpc("revoke_designer_access",{p_site_id:input.siteId,p_sessions:input.sessions});
 if(result.error) throw new Error("Não foi possível revogar o acesso ao Designer. Atualize e tente novamente.");
 revalidatePath("/dashboard","layout");
}
