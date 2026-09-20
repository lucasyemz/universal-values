import { z } from "zod";
import type { FieldChange } from "./change-plan";

export function suggestItemSlug(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export const slugPairSchema = z.strictObject({ before: z.string().min(1).max(256), after: z.string().min(1).max(256).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });
export const slugUpdatesSchema = z.record(z.string(), slugPairSchema);
export function isItemName(field: FieldChange) { return field.occurrence.field_slug === "name" && field.occurrence.field_type === "PlainText"; }
export function withSlugUpdates<T extends FieldChange>(plan: T[], updates: z.infer<typeof slugUpdatesSchema> | null | undefined): T[] {
  if (!updates) return plan;
  if (Object.keys(updates).some(key => !plan.some(f => f.sourceKey === key && isItemName(f)))) throw new Error("Slug sem nome de item correspondente.");
  return plan.map(field => updates[field.sourceKey] ? { ...field, slug: updates[field.sourceKey] } : field);
}
