"use server";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";
import { quotaErrorCode, quotaMessage } from "@/modules/plans/errors";
import { previewChanges } from "./change-actions";
import { loadChangeRequest } from "./change-service";
import { inlinePreview } from "./inline-preview";

export async function prepareInlineChanges(input: unknown) {
  const result = await previewChanges(input);
  if (!result.ok) return result;
  return readInlinePreview(result.id);
}
export async function readInlinePreview(id: string) {
  try {
    const view = await loadChangeRequest(id);
    if (view.request.status !== "preview" || view.expired) return { ok: false as const, refresh:true, message: "A prévia expirou ou já foi confirmada. Atualize os dados antes de aplicar." };
    return { ok: true as const, preview: inlinePreview(view) };
  } catch (error) { unstable_rethrow(error);return { ok: false as const, message: "Não foi possível carregar a prévia validada. Tente novamente." }; }
}
export async function confirmInlineChanges(input: unknown) {
  const parsed = z.strictObject({ id:z.uuid(), digest:z.string().regex(/^[a-f0-9]{64}$/), confirmed:z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok:false as const, message:"Confirme a prévia exibida antes de aplicar." };
  try {
    const view = await loadChangeRequest(parsed.data.id);
    if (inlinePreview(view).digest !== parsed.data.digest || view.request.status === "cancelled" || view.request.status === "preview" && view.expired)
      return { ok:false as const, refresh:true, message:"A prévia está desatualizada. Confira os valores atualizados antes de aplicar." };
    const { client } = await requireUser();
    // The existing RPC locks the immutable request, revalidates permissions/bindings,
    // reserves quota once, audits confirmation and schedules the conflict-aware worker.
    const result = await client.rpc("confirm_cms_changes", { p_id: parsed.data.id });
    if (result.error?.code === "23505" && result.error.message.includes("one_confirmed_change_per_site")) return { ok:false as const, refresh:true, message:"A fila de alterações ainda não está habilitada no banco. Aplique a migration 20260922000300_cms_change_queue.sql." };
    if (result.error?.message === "Managed value already queued") return { ok:false as const, refresh:true, message:"Este Managed Value já tem uma alteração na fila. Aguarde a conclusão antes de preparar outra versão." };
    if (result.error) return { ok:false as const, refresh:true, message:quotaMessage(quotaErrorCode(result.error)) ?? "Não foi possível confirmar. A conexão, os vínculos ou a versão podem ter mudado, ou há outra operação ativa." };
    if (view.request.scan_id) revalidatePath("/dashboard/scans/" + view.request.scan_id);
    if (view.request.managed_value_id) revalidatePath("/dashboard/managed-values/" + view.request.managed_value_id);
    return { ok:true as const, id:parsed.data.id };
  } catch (error) { unstable_rethrow(error);return { ok:false as const, message:"Não foi possível confirmar a operação. Tente novamente para recuperar a mesma solicitação." }; }
}
