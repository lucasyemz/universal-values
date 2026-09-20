import "server-only";
import { requireUser } from "@/modules/auth/service";
import { getConnectionReader } from "@/modules/sites/service";
import { loadChangeRequest } from "./change-service";
import { isItemName, slugUpdatesSchema, suggestItemSlug } from "./item-slug";

// Snapshot only during preview. Execution never derives an unreviewed slug.
export async function prepareItemSlugs(id: string) {
  const { request, plan } = await loadChangeRequest(id);
  if (request.slug_updates || request.status !== "preview") return;
  const names = plan.filter(isItemName);
  if (!names.length) return;
  const updates: Record<string, { before: string; after: string }> = {};
  if (request.reverts_request_id) {
    const { request: original } = await loadChangeRequest(request.reverts_request_id);
    for (const field of names) {
      const pair = original.slug_updates?.[field.sourceKey];
      // Legacy operations did not alter slugs: keep their current slug.
      if (pair) {
        const result = original.results.find(r => r.sourceKey === field.sourceKey && r.status === "applied");
        if (!result?.slugActual) throw new Error("Resultado do slug indisponível para reversão.");
        updates[field.sourceKey] = { before: result.slugActual, after: pair.before };
      }
    }
  }
  const missing = names.filter(field => !updates[field.sourceKey]);
  if (missing.length) {
    const { reader } = await getConnectionReader(request.connection_id);
    for (const field of missing) {
      const o = field.occurrence;
      const item = await reader.item(o.collection_id, o.item_id, o.locale);
      if (item.id !== o.item_id || (o.locale && item.cmsLocaleId !== o.locale) || item.isArchived || typeof item.fieldData.slug !== "string") throw new Error("Não foi possível conferir o slug atual do item.");
      if (typeof field.after !== "string" || !field.after.trim()) throw new Error("O nome do item CMS não pode ficar vazio.");
      const after = request.reverts_request_id || field.before === field.after ? item.fieldData.slug : suggestItemSlug(field.after);
      if (!after || after.length > 256) throw new Error("O novo nome não gera um slug válido. Use letras ou números e até 256 caracteres no slug.");
      updates[field.sourceKey] = { before: item.fieldData.slug, after };
    }
  }
  const parsed = slugUpdatesSchema.parse(updates);
  const { client } = await requireUser();
  const { error } = await client.rpc("prepare_cms_item_slugs", { p_id: id, p_updates: parsed });
  if (error) throw new Error("Não foi possível salvar a revisão dos slugs. Prepare uma nova prévia.");
}
