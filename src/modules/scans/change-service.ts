import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { getConnectionReader } from "@/modules/sites/service";
import { getScan, getScanSite } from "./service";
import { occurrenceSchema } from "./schema";
import { changeRequestSchema, buildRequestPlan } from "./change-request-plan";
import { executeChangeField } from "./execute-change-field";
export { changeRequestSchema } from "./change-request-plan";

export async function loadChangeRequest(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, user } = await requireUser();
  const result = await client.from("cms_change_requests").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar a prévia. Confira a migration de alterações.");
  if (!result.data || result.data.actor_id !== user.id) notFound();
  const request = changeRequestSchema.parse(result.data);
  if (request.managed_value_id) { await getScanSite(request.site_id); return buildRequestPlan(request); }
  if (!request.scan_id) throw new Error("Scan indisponível.");
  await getScan(request.scan_id);
  const rows = await client.from("scan_occurrences").select("*").eq("scan_id", request.scan_id).limit(1000);
  if (rows.error) throw new Error("Ocorrências indisponíveis.");
  let original;
  if (request.reverts_request_id) {
    const parent = await client.from("cms_change_requests").select("*").eq("id", request.reverts_request_id).maybeSingle();
    if (parent.error || !parent.data) throw new Error("Operação original indisponível.");
    original = changeRequestSchema.parse(parent.data);
  }
  return buildRequestPlan(request, z.array(occurrenceSchema).parse(rows.data), original);
}

export async function processChangeStep(id: string, cursor: number) {
  const { request, plan, managedPlan } = await loadChangeRequest(id);
  if (request.status !== "confirmed" || request.background_paused) return request;
  const { client } = await requireUser();
  const lease = randomUUID();
  const claim = await client.rpc("claim_cms_change", { p_id: id, p_cursor: cursor, p_lease: lease });
  if (claim.error) throw new Error("Não foi possível reservar esta alteração.");
  if (!claim.data) return (await loadChangeRequest(id)).request;
  const field = plan[cursor];
  if (!field) throw new Error("Campo indisponível.");
  const managedField = managedPlan?.[cursor];
  const args = { p_id: id, p_cursor: cursor, p_lease: lease };
  const dispatched = (await loadChangeRequest(id)).request.dispatched;
  const { result, wait } = await executeChangeField({ request, field, managedField, dispatched }, {
    getSite: () => getScanSite(request.site_id),
    getConnection: () => getConnectionReader(request.connection_id),
    dispatch: async () => { const sent = await client.rpc("dispatch_cms_change", args); if (sent.error) throw new Error("dispatch_unavailable"); return sent.data === true; },
  });
  const saved = await client.rpc("finish_cms_change", { ...args, p_result: result, p_wait: wait });
  if (saved.error) throw new Error("O resultado não pôde ser registrado. Retome para reconciliar, sem reenviar a escrita.");
  return (await loadChangeRequest(id)).request;
}
