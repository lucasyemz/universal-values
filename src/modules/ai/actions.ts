"use server";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { getScanSite, loadScanResults } from "@/modules/scans/service";
import { getConnectionReader } from "@/modules/sites/service";
import { siteContentLanguage } from "./language";
import { buildAiContext } from "./context";
import { readAiMetadata } from "./context-reader";
import type { AiContext } from "./schema";

type Result = { ok: true; context: AiContext } | { ok: false; message: string };
const unavailable = "Não foi possível ler o contexto. Confira a conexão Webflow e seus limites de leitura.";

// Authentication and Managed Value protection are rechecked even when metadata is cached.
// Item bodies are always read fresh, once per item/locale within this batch.
export async function prepareAiContexts(input: unknown): Promise<Record<string, Result>> {
  const parsed = z.strictObject({ scanId: z.uuid(), occurrenceIds: z.array(z.uuid()).min(1).max(20) }).safeParse(input);
  if (!parsed.success) return {};
  const results: Record<string, Result> = {};
  try {
    const view = await loadScanResults(parsed.data.scanId);
    if (!["completed", "limited"].includes(view.scan.status)) throw new Error("Scan unavailable");
    const selected = [...new Set(parsed.data.occurrenceIds)].flatMap(id => {
      const occurrence = view.occurrences.find(row => row.id === id);
      if (!occurrence || occurrence.canonical.type !== "text") { results[id] = { ok: false, message: "Selecione uma ocorrência válida." }; return []; }
      if (view.linkedValues[occurrence.source_key] && !view.editableBoundOccurrenceIds.includes(id)) {
        results[id] = { ok: false, message: "O trecho está protegido por um Managed Value." }; return [];
      }
      return [occurrence];
    });
    if (!selected.length) return results;
    const site = await getScanSite(view.scan.site_id);
    const { reader, connection } = await getConnectionReader(site.connection_id);
    if (connection.workspace_id !== site.workspace_id) throw new Error("Workspace unavailable");
    const scope = JSON.stringify([connection.id, connection.actor_id, connection.workspace_id]);
    const items = new Map<string, Promise<Awaited<ReturnType<typeof reader.item>>>>();
    for (const occurrence of selected) {
      try {
        const { collection, site: remoteSite } = await readAiMetadata(scope, site.webflow_site_id, occurrence.collection_id, reader);
        const itemKey = JSON.stringify([occurrence.collection_id, occurrence.item_id, occurrence.locale]);
        let item = items.get(itemKey);
        if (!item) { item = reader.item(occurrence.collection_id, occurrence.item_id, occurrence.locale); items.set(itemKey, item); }
        const current = await item;
        try {
          results[occurrence.id] = { ok: true, context: { ...buildAiContext(occurrence, collection, current), siteLanguage: siteContentLanguage(remoteSite, occurrence.locale) } };
        } catch {
          results[occurrence.id] = { ok: false, message: "O item ou campo mudou desde o scan. Execute um novo scan para obter contexto atualizado." };
        }
      } catch (error) { unstable_rethrow(error); results[occurrence.id] = { ok: false, message: unavailable }; }
    }
  } catch (error) {
    unstable_rethrow(error);
    for (const id of parsed.data.occurrenceIds) results[id] ??= { ok: false, message: unavailable };
  }
  return results;
}
export async function prepareAiContext(input: unknown): Promise<Result> {
  const parsed = z.strictObject({ scanId: z.uuid(), occurrenceId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Selecione uma ocorrência válida." };
  return (await prepareAiContexts({ scanId: parsed.data.scanId, occurrenceIds: [parsed.data.occurrenceId] }))[parsed.data.occurrenceId] ?? { ok: false, message: unavailable };
}
