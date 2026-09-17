"use server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { designerSite } from "./dashboard-service";

export async function authorizeDesigner(_previous: { code?: string; error?: string }, form: FormData): Promise<{ code?: string; error?: string }> {
  const input = z.object({ id: z.uuid(), siteId: z.uuid(), confirmed: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Revise o acesso e marque a confirmação." };
  const { client } = await designerSite(input.data.siteId);
  const code = "uvd_" + randomBytes(32).toString("hex");
  const result = await client.rpc("authorize_designer_session", { p_id: input.data.id, p_site_id: input.data.siteId, p_token_hash: createHash("sha256").update(code).digest("hex") });
  if (result.error) return { error: "Não foi possível autorizar. Confira a migration 009; recarregue a página para tentar novamente." };
  revalidatePath("/dashboard/sites/" + input.data.siteId + "/static");
  return { code };
}
export async function revokeDesigner(form: FormData) {
  const input = z.object({ id: z.uuid(), siteId: z.uuid(), confirmed: z.literal("on") }).parse(Object.fromEntries(form));
  const { client } = await designerSite(input.siteId);
  const result = await client.rpc("revoke_designer_session", { p_id: input.id });
  if (result.error) throw new Error("Não foi possível revogar a sessão.");
  revalidatePath("/dashboard/sites/" + input.siteId + "/static");
}
