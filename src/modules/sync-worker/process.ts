import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkerDatabase } from "@/connectors/supabase/worker";
import { decryptToken } from "@/connectors/webflow/crypto";
import { WebflowReader } from "@/connectors/webflow/client";
import { WebflowWriter } from "@/connectors/webflow/writer";
import { occurrenceSchema } from "@/modules/scans/schema";
import { changeRequestSchema, buildRequestPlan } from "@/modules/scans/change-request-plan";
import { executeChangeField, type FieldDependencies } from "@/modules/scans/execute-change-field";
import { linkedSiteSchema } from "@/modules/sites/schema";

export const workerPayloadSchema = z.object({
  request: changeRequestSchema, occurrences: z.array(occurrenceSchema).max(1000), parent: changeRequestSchema.nullable(),
  site: linkedSiteSchema, connection: z.object({ id: z.uuid(), workspace_id: z.uuid(), actor_id: z.uuid() }), credential: z.string().min(1),
});
type Payload = z.infer<typeof workerPayloadSchema>;
export function workerConnection(payload: Payload, encryptionKey: string, fetcher: typeof fetch = fetch): Awaited<ReturnType<FieldDependencies["getConnection"]>> {
  const c = payload.connection;
  const token = decryptToken(payload.credential, ["webflow", c.id, c.workspace_id, c.actor_id].join(":"), encryptionKey);
  return { connection: c, reader: new WebflowReader(token, fetcher), writer: new WebflowWriter(token, fetcher) };
}
export async function processWorkerTurn(database: WorkerDatabase, connect: (payload: Payload) => Awaited<ReturnType<FieldDependencies["getConnection"]>>) {
  const lease = randomUUID();
  const raw = await database.claim(lease);
  if (raw === null) return { idle: true as const };
  // Read only the routing identity before parsing the complete untrusted payload;
  // a corrupt plan can then be durably paused instead of looping forever.
  const identity = z.object({ request: z.object({ id: z.uuid(), cursor: z.number().int().nonnegative() }) }).parse(raw).request;
  try {
    const payload = workerPayloadSchema.parse(raw), r = payload.request;
    if (r.status !== "confirmed" || r.background_paused || payload.site.id !== r.site_id || payload.site.workspace_id !== r.workspace_id || payload.site.connection_id !== r.connection_id || payload.connection.id !== r.connection_id || payload.connection.workspace_id !== r.workspace_id || payload.connection.actor_id !== r.actor_id) throw new Error("Invalid worker context");
    if (payload.occurrences.some(o => o.scan_id !== r.scan_id || o.site_id !== r.site_id)) throw new Error("Invalid scan evidence");
    const view = buildRequestPlan(r, payload.occurrences, payload.parent ?? undefined);
    const field = view.plan[r.cursor];
    if (!field) throw new Error("Invalid worker cursor");
    const { result, wait } = await executeChangeField({ request: r, field, managedField: view.managedPlan?.[r.cursor], dispatched: r.dispatched }, {
      getSite: async () => payload.site,
      getConnection: async () => connect(payload),
      dispatch: async () => (await database.step(r.id, r.cursor, lease, "dispatch")) === true,
    });
    await database.step(r.id, r.cursor, lease, "finish", result, wait);
    return { idle: false as const, id: r.id, status: result.status };
  } catch {
    // If finish committed but its response was lost, pause can be rejected as a
    // stale cursor. The next iteration will discover the durable DB position.
    try { await database.step(identity.id, identity.cursor, lease, "pause"); } catch { /* A newer lease/result wins. */ }
    return { idle: false as const, id: identity.id, status: "worker_error" };
  }
}
