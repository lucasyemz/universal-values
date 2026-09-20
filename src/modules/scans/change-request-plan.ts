import { slugUpdatesSchema, withSlugUpdates } from "./item-slug";
import { z } from "zod";
import { buildManagedSyncPlan, locationsSchema } from "@/modules/managed-values/sync-plan";
import { managedValueSchema } from "@/modules/managed-values/schema";
import type { Occurrence } from "./schema";
import { buildFieldChanges, changesSchema, sameField } from "./change-plan";
import { failedChangesForRetry } from "./retry-changes";
import { buildRevertPlan, reversibleFieldCount } from "./revert-changes";

export const changeRequestSchema = z.object({
  id: z.uuid(), scan_id: z.uuid().nullable(), site_id: z.uuid(), workspace_id: z.uuid(), actor_id: z.uuid(), connection_id: z.uuid(),
  slug_updates: slugUpdatesSchema.nullish(),
  changes: z.union([changesSchema, z.tuple([])]),
  managed_value_id: z.uuid().nullish().transform(value => value ?? null),
  managed_resolution: z.object({ bindingId: z.uuid(), scanId: z.uuid(), occurrenceIds: z.array(z.uuid()).min(1), mode: z.enum(["keep", "adopt"]) }).nullish(),
  managed_version: z.number().int().positive().nullish(),
  managed_before: managedValueSchema.nullish(), managed_after: managedValueSchema.nullish(), managed_snapshot: z.json().nullish(),
  background_paused: z.boolean().optional(), worker_error: z.string().nullable().optional(),
  status: z.enum(["preview", "confirmed", "completed", "cancelled"]), cursor: z.number().int().nonnegative(), total: z.number().int().positive(),
  dispatched: z.boolean(), lease_until: z.string().nullable(), retry_at: z.string().nullable(), expires_at: z.string(),
  reverts_request_id: z.uuid().nullish().transform((value) => value ?? null),
  results: z.array(z.object({ status: z.enum(["applied", "already_applied", "conflict", "failed", "uncertain"]), message: z.string(), sourceKey: z.string(), actual: z.json().optional(), slugActual: z.string().optional(), bindingSource: z.string().optional(), bindingLocations: locationsSchema.optional() })),
});

export function buildRequestPlan(request: z.infer<typeof changeRequestSchema>, occurrences: Occurrence[] = [], original?: z.infer<typeof changeRequestSchema>) {
  if (request.managed_value_id) {
    if (!request.managed_after || !request.managed_snapshot || request.reverts_request_id || request.scan_id) throw new Error("Plano de sincronização inválido.");
    const managed = buildManagedSyncPlan(request.managed_snapshot, request.managed_after, request.id);
    if (managed.plan.length !== request.total || managed.plan.some(field => field.binding.managed_value_id !== request.managed_value_id || field.binding.site_id !== request.site_id)) throw new Error("Vínculos inconsistentes.");
    return { request: { ...request, changes: managed.changes }, ...managed, plan: withSlugUpdates(managed.plan, request.slug_updates), managedPlan: managed.plan, revertCount: 0, retryCount: 0, expired: new Date(request.expires_at).getTime() <= Date.now() };
  }
  let plan = buildFieldChanges(occurrences, request.changes);
  if (request.reverts_request_id) {
    if (!original) throw new Error("Operação original indisponível.");
    if (original.reverts_request_id || original.site_id !== request.site_id || original.scan_id !== request.scan_id || original.actor_id !== request.actor_id || !["completed", "cancelled"].includes(original.status)) throw new Error("Reversão inválida.");
    if (!request.changes.every((change) => original.changes.some((c) => c.occurrenceId === change.occurrenceId && sameField(c.after, change.after)))) throw new Error("Alterações de origem inválidas.");
    plan = buildRevertPlan(plan, original.results);
  }
  plan = withSlugUpdates(plan, request.slug_updates);
  if (plan.length !== request.total) throw new Error("Plano inconsistente. Prepare outra prévia.");
  return { request, plan, occurrences, managedPlan: null, revertCount: request.reverts_request_id ? 0 : reversibleFieldCount(request.results), retryCount: failedChangesForRetry(request.changes, plan, request.results).length, expired: new Date(request.expires_at).getTime() <= Date.now() };
}
