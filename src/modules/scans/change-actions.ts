"use server";
import { quotaErrorCode, quotaMessage } from "@/modules/plans/errors";

import { prepareItemSlugs } from "./slug-service";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";
import { loadScanResults } from "./service";
import { buildFieldChanges, changesSchema } from "./change-plan";
import { loadChangeRequest } from "./change-service";
import { isRepeatedGroupSelection } from "./changes";
import { failedChangesForRetry } from "./retry-changes";

export async function previewChanges(input: unknown) {
  const parsed = z.strictObject({ id: z.uuid(), scanId: z.uuid(), changes: changesSchema }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Revise os valores e a seleção antes de continuar." };
  try {
    const view = await loadScanResults(parsed.data.scanId);
    if (!["completed", "limited"].includes(view.scan.status)) return { ok: false as const, message: "Aguarde a conclusão do scan." };
    if (!isRepeatedGroupSelection(view.occurrences, parsed.data.changes.map((change) => change.occurrenceId), view.scan.plan.some(entry => !!entry.searchText || entry.placeholders))) return { ok: false as const, message: "Revise apenas ocorrências de um mesmo grupo de valores repetidos por vez." };
    if (parsed.data.changes.some(change => { const source = view.occurrences.find(o => o.id === change.occurrenceId); return source && view.linkedValues[source.source_key] && !view.editableBoundOccurrenceIds.includes(source.id); })) return { ok: false as const, message: "Este trecho está protegido ou seu vínculo está desatualizado. Abra o Managed Value ou execute um novo scan." };
    const plan = buildFieldChanges(view.occurrences, parsed.data.changes);
    if (!plan.length) return { ok: false as const, message: "Nenhum valor foi alterado." };
    // Store only effective changes, keeping DB field counts identical to the execution plan.
    const effectiveIds = new Set(plan.flatMap((field) => field.occurrenceIds));
    const changes = parsed.data.changes.filter((c) => effectiveIds.has(c.occurrenceId));
    const { client } = await requireUser();
    const result = await client.rpc("preview_cms_changes", { p_id: parsed.data.id, p_scan_id: parsed.data.scanId, p_changes: changes });
    if (quotaErrorCode(result.error)) return { ok: false as const, message: quotaMessage(quotaErrorCode(result.error))! };
    if (result.error) return { ok: false as const, message: changes.some((c) => c.after.type === "text" && c.after.text === "") ? "Não foi possível salvar a remoção. Confira se a oitava migration foi aplicada e se a conexão do site está ativa." : "Não foi possível salvar a prévia. Confira a quinta migration e a conexão do site." };
    await prepareItemSlugs(parsed.data.id);
    return { ok: true as const, id: parsed.data.id };
  } catch (error) {
    return { ok: false as const, message: error instanceof z.ZodError ? "Um dos valores é inválido." : "Não foi possível preparar as alterações. Confira os valores, atualize o scan e tente novamente." };
  }
}

export async function confirmChanges(form: FormData) {
  const parsed = z.object({ id: z.uuid(), confirmed: z.literal("yes") }).safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!parsed.success) redirect("/dashboard?error=confirmation");
  const { request } = await loadChangeRequest(parsed.data.id);
  const { client } = await requireUser();
  const result = await client.rpc("confirm_cms_changes", { p_id: parsed.data.id });
  if (quotaErrorCode(result.error)) redirect("/dashboard?error=" + quotaErrorCode(result.error));
  if (!result.error && request.managed_resolution) revalidatePath("/dashboard/scans/" + request.managed_resolution.scanId);
  if (!result.error && request.managed_value_id) revalidatePath("/dashboard/managed-values/" + request.managed_value_id);
  redirect("/dashboard/changes/" + parsed.data.id + (result.error ? "?error=confirmation" : ""));
}

export async function getChangeProgress(input: unknown) {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Solicitação inválida." };
  try {
    const { request } = await loadChangeRequest(parsed.data.id);
    const { client } = await requireUser();
    const health = await client.rpc("cms_worker_last_seen", {});
    if (health.error && !["PGRST202", "42883"].includes(health.error.code)) throw new Error("Worker health unavailable");
    const worker = health.error ? "missing" as const : health.data && Date.now() - Date.parse(health.data) < 180000 ? "online" as const : "offline" as const;
    return { ok: true as const, worker, progress: { cursor: request.cursor, total: request.total, status: request.status, paused: request.background_paused ?? false, error: request.worker_error } };
  } catch { return { ok: false as const, message: "Não foi possível atualizar o progresso. O processamento no servidor independe desta tela." }; }
}

export async function resumeChanges(input: unknown) {
  const parsed = z.object({ id: z.uuid(), cursor: z.number().int().nonnegative(), confirmed: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Confirme a continuação da operação." };
  const { client } = await requireUser();
  const result = await client.rpc("resume_background_cms", { p_id: parsed.data.id, p_cursor: parsed.data.cursor });
  if (result.error) return { ok: false as const, message: "Não foi possível retomar. Atualize o resultado, confira a migration 015 e aguarde o fim de qualquer etapa ativa." };
  revalidatePath("/dashboard/changes/" + parsed.data.id);
  return { ok: true as const };
}

export async function cancelChanges(form: FormData) {
  const parsed = z.object({ id: z.uuid(), confirmed: z.literal("yes") }).safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!parsed.success) redirect("/dashboard?error=confirmation");
  const { client } = await requireUser();
  const result = await client.rpc("cancel_cms_changes", { p_id: parsed.data.id });
  redirect("/dashboard/changes/" + parsed.data.id + (result.error ? "?error=cancel" : ""));
}

export async function retryFailedChanges(form: FormData) {
  const parsed = z.strictObject({ id: z.uuid(), retryId: z.uuid() }).safeParse({ id: form.get("id"), retryId: form.get("retryId") });
  if (!parsed.success) redirect("/dashboard?error=invalid");
  const { request, plan } = await loadChangeRequest(parsed.data.id);
  const back = "/dashboard/changes/" + request.id;
  if (request.managed_value_id || !request.scan_id) redirect("/dashboard/managed-values/" + request.managed_value_id);
  if (!["completed", "cancelled"].includes(request.status)) redirect(back + "?error=retry_active");
  if (request.retry_at && new Date(request.retry_at).getTime() > Date.now()) redirect(back + "?error=retry_wait");
  const changes = failedChangesForRetry(request.changes, plan, request.results);
  if (!changes.length) redirect(back + "?error=retry_empty");
  const { client } = await requireUser();
  // The RPC pins the site's CURRENT connection and records an immutable audited preview.
  // Preserve the previous request and its durable dispatch markers unchanged.
  const result = request.reverts_request_id
    ? await client.rpc("preview_cms_revert", { p_id: parsed.data.retryId, p_original_id: request.reverts_request_id, p_sources: request.results.filter((r) => r.status === "failed").map((r) => r.sourceKey) })
    : await client.rpc("preview_cms_changes", { p_id: parsed.data.retryId, p_scan_id: request.scan_id, p_changes: changes });
  if (result.error) redirect(back + "?error=retry");
  try { await prepareItemSlugs(parsed.data.retryId); } catch { redirect(back + "?error=slug_preview"); }
  redirect("/dashboard/changes/" + parsed.data.retryId);
}

export async function previewRevert(form: FormData) {
  const parsed = z.strictObject({ id: z.uuid(), revertId: z.uuid() }).safeParse({ id: form.get("id"), revertId: form.get("revertId") });
  if (!parsed.success) redirect("/dashboard?error=invalid");
  const { request, revertCount } = await loadChangeRequest(parsed.data.id);
  const back = "/dashboard/changes/" + request.id;
  if (request.managed_value_id) redirect("/dashboard/managed-values/" + request.managed_value_id);
  if (request.reverts_request_id || !revertCount || !["completed", "cancelled"].includes(request.status)) redirect(back + "?error=revert_unavailable");
  const { client } = await requireUser();
  const result = await client.rpc("preview_cms_revert", { p_id: parsed.data.revertId, p_original_id: request.id });
  if (result.error) redirect(back + "?error=revert");
  try { await prepareItemSlugs(parsed.data.revertId); } catch { redirect(back + "?error=slug_preview"); }
  redirect("/dashboard/changes/" + parsed.data.revertId);
}

export async function reviewItemSlugs(form: FormData) {
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) redirect("/dashboard?error=invalid");
  try { await prepareItemSlugs(id.data); }
  catch { redirect("/dashboard/changes/" + id.data + "?error=slug_preview"); }
  revalidatePath("/dashboard/changes/" + id.data);
  redirect("/dashboard/changes/" + id.data);
}
