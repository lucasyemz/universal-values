"use server";
import { z } from "zod";
import { loadManagedSyncValue } from "./sync-service";
import { resourceLink } from "@/modules/routes/links";
export async function loadManagedContext(input: unknown) {
  const parsed = z.strictObject({ siteId: z.uuid(), valueId: z.uuid(), page: z.number().int().min(1).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false as const };
  try {
    const view = await loadManagedSyncValue(parsed.data.valueId);
    if (view.value.site_id !== parsed.data.siteId) return { ok: false as const };
    const bindings = view.value.archived_at ? view.archivedBindings : view.bindings;
    const pageSize = 10;
    return { ok: true as const, value: view.value, href: await resourceLink("managed-values", view.value.id),
      disabled: !!view.value.archived_at || view.missingMigration || !view.bindings.length || !!view.activeOperation,
      total: bindings.length, page: parsed.data.page, hasMore: parsed.data.page * pageSize < bindings.length,
      sources: bindings.slice((parsed.data.page - 1) * pageSize, parsed.data.page * pageSize).map(binding => ({ id: binding.id, field: binding.field_slug, collection: binding.collection_id, item: binding.item_id, locale: binding.locale, value: binding.source_value, uncertain: binding.uncertain, verifiedAt: binding.last_synced_at })) };
  } catch { return { ok: false as const }; }
}
