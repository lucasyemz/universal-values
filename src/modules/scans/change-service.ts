import "server-only";
import { buildManagedSyncPlan, locationsSchema } from "@/modules/managed-values/sync-plan";
import { managedValueSchema } from "@/modules/managed-values/schema";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { getConnectionReader } from "@/modules/sites/service";
import { WebflowError } from "@/connectors/webflow/client";
import { getScan, getScanSite } from "./service";
import { occurrenceSchema } from "./schema";
import { buildFieldChanges, changesSchema, sameField } from "./change-plan";
import { failedChangesForRetry } from "./retry-changes";
import { buildRevertPlan, reversibleFieldCount } from "./revert-changes";

export const changeRequestSchema = z.object({
  id: z.uuid(), scan_id: z.uuid().nullable(), site_id: z.uuid(), workspace_id: z.uuid(), actor_id: z.uuid(), connection_id: z.uuid(),
  changes: z.union([changesSchema, z.tuple([])]),
  managed_value_id: z.uuid().nullish().transform(value => value ?? null),
  managed_resolution: z.object({ bindingId: z.uuid(), scanId: z.uuid(), occurrenceIds: z.array(z.uuid()).min(1), mode: z.enum(["keep", "adopt"]) }).nullish(),
  managed_version: z.number().int().positive().nullish(),
  managed_before: managedValueSchema.nullish(), managed_after: managedValueSchema.nullish(), managed_snapshot: z.json().nullish(),
  status: z.enum(["preview", "confirmed", "completed", "cancelled"]), cursor: z.number().int().nonnegative(), total: z.number().int().positive(),
  dispatched: z.boolean(), lease_until: z.string().nullable(), retry_at: z.string().nullable(), expires_at: z.string(),
  reverts_request_id: z.uuid().nullish().transform((value) => value ?? null),
  results: z.array(z.object({ status: z.enum(["applied", "already_applied", "conflict", "failed", "uncertain"]), message: z.string(), sourceKey: z.string(), actual: z.json().optional(), bindingSource: z.string().optional(), bindingLocations: locationsSchema.optional() })),
});

export async function loadChangeRequest(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, user } = await requireUser();
  const result = await client.from("cms_change_requests").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar a prévia. Confira a migration de alterações.");
  if (!result.data || result.data.actor_id !== user.id) notFound();
  const request = changeRequestSchema.parse(result.data);
  if (request.managed_value_id) {
    await getScanSite(request.site_id);
    if (!request.managed_after || !request.managed_snapshot || request.reverts_request_id || request.scan_id) throw new Error("Plano de sincronização inválido.");
    const managed = buildManagedSyncPlan(request.managed_snapshot, request.managed_after, request.id);
    if (managed.plan.length !== request.total || managed.plan.some(field => field.binding.managed_value_id !== request.managed_value_id || field.binding.site_id !== request.site_id)) throw new Error("Vínculos inconsistentes.");
    return { request: { ...request, changes: managed.changes }, ...managed, managedPlan: managed.plan, revertCount: 0, retryCount: 0, expired: new Date(request.expires_at).getTime() <= Date.now() };
  }
  if (!request.scan_id) throw new Error("Scan indisponível.");
  await getScan(request.scan_id);
  const rows = await client.from("scan_occurrences").select("*").eq("scan_id", request.scan_id).limit(1000);
  if (rows.error) throw new Error("Ocorrências indisponíveis.");
  const occurrences = z.array(occurrenceSchema).parse(rows.data);
  let plan = buildFieldChanges(occurrences, request.changes);
  if (request.reverts_request_id) {
    const parent = await client.from("cms_change_requests").select("*").eq("id", request.reverts_request_id).maybeSingle();
    if (parent.error || !parent.data) throw new Error("Operação original indisponível.");
    const original = changeRequestSchema.parse(parent.data);
    if (original.reverts_request_id || original.site_id !== request.site_id || original.scan_id !== request.scan_id || original.actor_id !== user.id || !["completed", "cancelled"].includes(original.status)) throw new Error("Reversão inválida.");
    if (!request.changes.every((change) => original.changes.some((c) => c.occurrenceId === change.occurrenceId && sameField(c.after, change.after)))) throw new Error("Alterações de origem inválidas.");
    plan = buildRevertPlan(plan, original.results);
  }
  if (plan.length !== request.total) throw new Error("Plano inconsistente. Prepare outra prévia.");
  return { request, plan, occurrences, managedPlan: null, revertCount: request.reverts_request_id ? 0 : reversibleFieldCount(request.results), retryCount: failedChangesForRetry(request.changes, plan, request.results).length, expired: new Date(request.expires_at).getTime() <= Date.now() };
}

export async function processChangeStep(id: string, cursor: number) {
  const { request, plan, managedPlan } = await loadChangeRequest(id);
  if (request.status !== "confirmed") return request;
  const { client } = await requireUser();
  const lease = randomUUID();
  const claim = await client.rpc("claim_cms_change", { p_id: id, p_cursor: cursor, p_lease: lease });
  if (claim.error) throw new Error("Não foi possível reservar esta alteração.");
  if (!claim.data) return (await loadChangeRequest(id)).request;
  const field = plan[cursor];
  if (!field) throw new Error("Campo indisponível.");
  const managedField = managedPlan?.[cursor];
  const args = { p_id: id, p_cursor: cursor, p_lease: lease };
  // Reload after acquiring the lease: a previous worker may have dispatched
  // between our first read and this reservation.
  let dispatched = (await loadChangeRequest(id)).request.dispatched;
  let sentThisAttempt = false;
  let writeCompleted = false;
  let wait = 0;
  let result: z.infer<typeof changeRequestSchema>["results"][number];
  try {
    const site = await getScanSite(request.site_id);
    if (site.connection_id !== request.connection_id) throw new Error("connection_changed");
    const { reader, writer, connection } = await getConnectionReader(request.connection_id);
    if (connection.workspace_id !== request.workspace_id) throw new Error("connection_changed");
    const [sites, collections] = await Promise.all([reader.sites(), reader.collections(site.webflow_site_id)]);
    const o = field.occurrence;
    if (!sites.some((s) => s.id === site.webflow_site_id) || !collections.some((c) => c.id === o.collection_id)) throw new Error("source_changed");
    const [details, current] = await Promise.all([reader.collection(o.collection_id), reader.item(o.collection_id, o.item_id, o.locale)]);
    if (details.id !== o.collection_id || !details.fields.some((f) => f.slug === o.field_slug && f.type === o.field_type) || current.id !== o.item_id || (o.locale && current.cmsLocaleId !== o.locale) || current.isArchived) throw new Error("source_changed");
    const actual = current.fieldData[o.field_slug];
    if (sameField(actual, field.after)) {
      result = { sourceKey: field.sourceKey, status: "already_applied", message: "O campo já contém o valor desejado; nenhuma escrita foi repetida.", actual };
    } else if (dispatched || managedField?.binding.uncertain) {
      result = { sourceKey: field.sourceKey, status: "uncertain", message: managedField ? "Uma tentativa anterior perdeu a confirmação. Confira o campo no Webflow. Uma nova prévia só reconciliará esta fonte se a leitura corresponder exatamente ao valor esperado; não haverá reenvio automático." : "Uma tentativa anterior perdeu a confirmação. Confira o campo no Webflow e faça outro scan; esta operação não será reenviada.", ...(actual !== undefined ? { actual } : {}) };
    } else if (!sameField(actual, field.before)) {
      result = { sourceKey: field.sourceKey, status: "conflict", message: request.reverts_request_id ? "O campo foi editado após a alteração original. A reversão foi bloqueada para preservar essa edição." : managedField ? "O campo mudou desde o registro do vínculo. Nenhuma alteração aplicada. Confira a edição no Webflow; uma nova prévia não substitui automaticamente o registro em conflito." : "O campo mudou desde o scan. Nenhuma alteração aplicada; execute outro scan.", ...(actual !== undefined ? { actual } : {}) };
    } else {
      const send = await client.rpc("dispatch_cms_change", args);
      if (send.error || !send.data) throw new Error("dispatch_unavailable");
      dispatched = true;
      sentThisAttempt = true;
      const response = await writer.updateField({ collectionId: o.collection_id, itemId: o.item_id, locale: o.locale, field: o.field_slug, value: field.after });
      writeCompleted = true;
      const applied = response.fieldData[o.field_slug];
      if (applied === undefined) throw new Error("missing_response_field");
      const imageField = ["Image", "ImageRef", "MultiImage"].includes(o.field_type);
      if ((!imageField || managedField) && !sameField(applied, field.after)) throw new Error("unexpected_response_field");
      if (managedField) {
        const verified = await reader.item(o.collection_id, o.item_id, o.locale);
        if (verified.id !== o.item_id || verified.isArchived || (o.locale && verified.cmsLocaleId !== o.locale) || !sameField(verified.fieldData[o.field_slug], field.after)) throw new Error("verification_failed");
      }
      result = { sourceKey: field.sourceKey, status: "applied", message: "Alteração salva no CMS preparado. O site não foi publicado.", actual: applied };
    }
  } catch (error) {
    const permission = error instanceof WebflowError && ["unauthorized", "forbidden"].includes(error.kind);
    const rateLimit = error instanceof WebflowError && error.kind === "rate_limit";
    if (rateLimit) wait = Math.min(86400, Math.max(5, Math.ceil(error.retryAfter ?? 60)));
    const knownRejected = sentThisAttempt && !writeCompleted && (permission || rateLimit);
    result = { sourceKey: field.sourceKey, status: dispatched && !knownRejected ? "uncertain" : "failed", message: permission ? "Reconecte o Webflow com cms:write, vincule o site novamente e prepare outra prévia." : rateLimit ? "O Webflow limitou as chamadas. Aguarde o período indicado pelo provedor antes de preparar outra prévia." : dispatched ? "Não foi possível confirmar a escrita. Confira o campo no Webflow antes de preparar uma nova prévia." : "A fonte ou conexão mudou, ou a leitura falhou. Nenhuma escrita foi enviada para este campo." };
  }
  if (managedField && ["applied", "already_applied"].includes(result.status)) {
    result = { ...result, bindingSource: managedField.nextSource, bindingLocations: managedField.nextLocations };
  }
  const saved = await client.rpc("finish_cms_change", { ...args, p_result: result, p_wait: wait });
  if (saved.error) throw new Error("O resultado não pôde ser registrado. Retome para reconciliar, sem reenviar a escrita.");
  return (await loadChangeRequest(id)).request;
}
