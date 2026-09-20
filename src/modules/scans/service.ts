import "server-only";
import { isIndependentManagedText } from "./managed-protection";
import { bindingSchema } from "@/modules/managed-values/sync-plan";
import { scanDivergences } from "@/modules/managed-values/divergence";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { getConnectionReader, requireWorkspaceOwner } from "@/modules/sites/service";
import { linkedSiteSchema } from "@/modules/sites/schema";
import { WebflowError } from "@/connectors/webflow/client";
import { groupOccurrences, groupScanResults, occurrenceSchema, savedValueSchema, scanSchema, valuePreviewSchema, type Scan } from "./schema";
import { readScanBatch } from "./runner";

export async function getScanSite(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const result = await client.from("sites").select("id,workspace_id,connection_id,webflow_site_id,display_name").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Site indisponível.");
  if (!result.data) notFound();
  const site = linkedSiteSchema.parse(result.data);
  await requireWorkspaceOwner(site.workspace_id);
  return site;
}
export async function getScan(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, user } = await requireUser();
  const result = await client.from("cms_scans").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar o scan.");
  if (!result.data || result.data.actor_id !== user.id) notFound();
  const scan = scanSchema.parse(result.data);
  await requireWorkspaceOwner(scan.workspace_id);
  return scan;
}
export function scanProgress(scan: Scan) {
  return {
    id: scan.id, revision: scan.revision, status: scan.status,
    itemsRead: scan.items_read, count: scan.occurrences_count,
    retryAt: scan.retry_at, error: scan.error_code,
    collectionName: scan.plan[scan.collection_index]?.name ?? null,
    collectionsDone: scan.collection_index, collectionsTotal: scan.plan.length,
  };
}
export async function loadScanCollections(siteId: string) {
  const site = await getScanSite(siteId);
  const { reader, connection } = await getConnectionReader(site.connection_id);
  if (connection.workspace_id !== site.workspace_id) throw new Error("Site indisponível.");
  if (!(await reader.sites()).some((s) => s.id === site.webflow_site_id)) throw new Error("Site indisponível.");
  return reader.collections(site.webflow_site_id);
}
export async function loadSiteScans(siteId: string) {
  const site = await getScanSite(siteId);
  const { client } = await requireUser();
  const result = await client.from("cms_scans").select("*").eq("site_id", siteId).order("created_at", { ascending: false }).limit(20);
  if (result.error?.code === "PGRST205") return { site, scans: [], values: [], changes: [], missingMigration: true };
  if (result.error) throw new Error("Scans indisponíveis.");
  const values = await client.from("managed_values").select("*").eq("site_id", siteId).order("created_at", { ascending: false }).limit(100);
  if (values.error) throw new Error("Managed Values indisponíveis.");
  const changes = await client.from("cms_change_requests").select("id,status,cursor,total,created_at").eq("site_id", siteId).order("created_at", { ascending: false }).limit(20);
  if (changes.error && !["PGRST205", "42P01"].includes(changes.error.code)) throw new Error("Histórico de alterações indisponível.");
  const history = z.array(z.object({ id: z.uuid(), status: z.string(), cursor: z.number(), total: z.number(), created_at: z.string() })).parse(changes.data ?? []);
  return { site, scans: z.array(scanSchema).parse(result.data), values: z.array(savedValueSchema).parse(values.data), changes: history, missingMigration: false };
}
export async function loadScanResults(id: string) {
  const scan = await getScan(id);
  const { client } = await requireUser();
  const result = await client.from("scan_occurrences").select("*").eq("scan_id", id).order("id").limit(1000);
  if (result.error) throw new Error("Resultados indisponíveis.");
  const occurrences = z.array(occurrenceSchema).parse(result.data);
  const bindings = await client.from("managed_value_bindings").select("*").eq("site_id", scan.site_id).limit(1000);
  if (bindings.error) throw new Error("Vínculos indisponíveis.");
  const linked = z.array(z.object({ source_key: z.string(), managed_value_id: z.uuid() })).parse(bindings.data);
  const valueIds = [...new Set(linked.map(binding => binding.managed_value_id))];
  const values = valueIds.length ? await client.from("managed_values").select("*").in("id", valueIds) : { data: [], error: null };
  if (values.error) throw new Error("Valores vinculados indisponíveis.");
  const managedValues = z.array(savedValueSchema).parse(values.data);
  const names = new Map(managedValues.map(value => [value.id, value.name]));
  const fullBindings = z.array(bindingSchema).safeParse(bindings.data);
  const divergences = fullBindings.success ? scanDivergences(fullBindings.data, occurrences, scan.created_at).map(d => ({ ...d, value: managedValues.find(value => value.id === d.binding.managed_value_id)! })) : [];
  const linkedValues = Object.fromEntries(linked.map(binding => [binding.source_key, { id: binding.managed_value_id, name: names.get(binding.managed_value_id) ?? "Valor centralizado", divergence: divergences.some(d => d.binding.source_key === binding.source_key && !d.stale), bindingId: fullBindings.success ? fullBindings.data.find(b => b.source_key === binding.source_key)?.id : undefined }]));
  const editableBoundOccurrenceIds = fullBindings.success ? occurrences.filter(o => {
    const binding = fullBindings.data.find(b => b.source_key === o.source_key);
    return binding && isIndependentManagedText(o, binding);
  }).map(o => o.id) : [];
  const bound = new Set(linked.map((b) => b.source_key));
  const available = occurrences.filter((o) => !bound.has(o.source_key));
  const reviews = await client.rpc("scan_reviewed_occurrences", { p_scan_id: id });
  const reviewsMissing = !!reviews.error && ["PGRST202", "42883"].includes(reviews.error.code);
  if (reviews.error && !reviewsMissing) throw new Error("Marcações de revisão indisponíveis.");
  const reviewedIds = z.array(z.object({ occurrence_id: z.uuid() })).parse(reviews.data ?? []).map((row) => row.occurrence_id);
  return { scan, occurrences, reviewedIds, reviewsMissing, linkedValues, editableBoundOccurrenceIds, divergences, sections: groupScanResults(scan, occurrences, available), duplicates: groupOccurrences(occurrences, true), boundCount: occurrences.length - available.length, groups: groupOccurrences(available), expired: new Date(scan.expires_at).getTime() <= Date.now() };
}
export async function processBatch(id: string, revision: number) {
  const scan = await getScan(id);
  const site = await getScanSite(scan.site_id);
  if (scan.connection_id !== site.connection_id) throw new Error("A conexão mudou. Cancele este scan e inicie outro.");
  const { client } = await requireUser();
  const lease = randomUUID();
  const claim = await client.rpc("claim_cms_scan_batch", { p_id: id, p_revision: revision, p_lease: lease });
  if (claim.error) throw new Error("Não foi possível reservar o lote.");
  if (!claim.data) return scanProgress(await getScan(id));
  try {
    const { reader, connection } = await getConnectionReader(scan.connection_id);
    if (connection.workspace_id !== site.workspace_id) throw new Error("source_changed");
    const batch = await readScanBatch(scan, site.webflow_site_id, reader);
    const saved = await client.rpc("save_cms_scan_batch", {
      p_id: id, p_revision: revision, p_lease: lease, p_rows: batch.rows,
      p_items: batch.itemsRead, p_next_collection: batch.nextCollection, p_next_offset: batch.nextOffset,
      p_truncated: batch.truncated, p_skipped: batch.skippedFields,
    });
    if (saved.error) throw new Error("storage");
  } catch (error) {
    const limited = error instanceof WebflowError && error.kind === "rate_limit";
    const wait = limited ? Math.min(86400, Math.max(5, Math.ceil(error.retryAfter ?? 60))) : 10;
    const kind = limited ? "rate_limit" : error instanceof Error && ["source_changed", "storage"].includes(error.message) ? error.message : "provider";
    const paused = await client.rpc("pause_cms_scan", { p_id: id, p_revision: revision, p_lease: lease, p_error: kind, p_wait: wait });
    if (paused.error) throw new Error("O lote foi interrompido. Atualize a página para consultar o progresso salvo.");
  }
  return scanProgress(await getScan(id));
}
export async function loadValuePreview(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const result = await client.from("managed_value_previews").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Prévia indisponível.");
  if (!result.data) notFound();
  const preview = valuePreviewSchema.parse(result.data);
  await getScan(preview.scan_id);
  const rows = await client.from("scan_occurrences").select("*").in("id", preview.occurrence_ids).eq("scan_id", preview.scan_id);
  if (rows.error) throw new Error("Ocorrências indisponíveis.");
  return { preview, occurrences: z.array(occurrenceSchema).parse(rows.data), expired: new Date(preview.expires_at).getTime() <= Date.now() };
}
export async function loadManagedValue(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const result = await client.from("managed_values").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Managed Value indisponível.");
  if (!result.data) notFound();
  const value = savedValueSchema.parse(result.data);
  const bindings = await client.from("managed_value_bindings").select("*").eq("managed_value_id", id);
  if (bindings.error) throw new Error("Vínculos indisponíveis.");
  return { value, bindings: bindings.data };
}
