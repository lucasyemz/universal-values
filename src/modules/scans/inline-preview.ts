import { createHash } from "node:crypto";
import type { loadChangeRequest } from "./change-service";
import { isItemName } from "./item-slug";
import { valueLabel } from "./schema";

type View = Awaited<ReturnType<typeof loadChangeRequest>>;
const display = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value, null, 2);
export function inlinePreview(view: View) {
  const { request, plan } = view;
  if (plan.some(field => isItemName(field) && !field.slug)) throw new Error("Revise também o slug");
  const fields = plan.map(field => ({
    sourceKey: field.sourceKey, collection: field.occurrence.collection_name, item: field.occurrence.item_name,
    field: field.occurrence.field_name, locale: field.occurrence.locale,
    collectionId: field.occurrence.collection_id, itemId: field.occurrence.item_id,
    images: request.changes.flatMap(change => {
      if (!field.occurrenceIds.includes(change.occurrenceId) || change.after.type !== "image") return [];
      const original = view.occurrences.find(o => o.id === change.occurrenceId);
      return original?.canonical.type === "image" ? [{ before: original.canonical.url, after: change.after.url }] : [];
    }),
    before: display(field.before), after: display(field.after), slug: field.slug ?? null,
  }));
  const slugCount = fields.filter(field => field.slug && field.slug.before !== field.slug.after).length;
  const central = request.managed_before && request.managed_after ? { before: valueLabel(request.managed_before), after: valueLabel(request.managed_after) } : null;
  const content = { id: request.id, connectionId: request.connection_id, scanId: request.scan_id, managedVersion: request.managed_version ?? null, central, fields };
  // Status/results are excluded so retries after confirmation retain the same receipt.
  const digest = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return { id: request.id, scanId: request.scan_id, digest, expiresAt: request.expires_at, fields, central,
    fieldCount: fields.length + slugCount,
    itemCount: new Set(fields.map(field => JSON.stringify([field.collectionId, field.itemId, field.locale]))).size,
    slugCount, removalCount: request.changes.filter(change => change.after.type === "text" && change.after.text === "").length,
  };
}
export type InlinePreview = ReturnType<typeof inlinePreview>;
