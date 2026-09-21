import { numericSearchValue } from "./numeric-search";
import { searchOptionsSchema } from "@/modules/text-search/match";
import { z } from "zod";
import { managedValueSchema } from "@/modules/managed-values/schema";
import { webflowIdSchema } from "@/connectors/webflow/schemas";

export const SCAN_LIMITS = { collections: 20, items: 500, occurrences: 1000, batchOccurrences: 200, fieldLength: 2000, matchesPerField: 10 } as const;
export const detectionTypes = ["money", "phone", "date", "number", "text", "link", "image"] as const;
export const detectionLabels = { money: "Preços (R$)", phone: "Telefones", date: "Datas", number: "Números", text: "Textos repetidos", link: "Links", image: "Imagens e galerias" };
const typesSchema = z.array(z.enum(detectionTypes)).min(1).max(detectionTypes.length);
export const searchTextSchema = z.string().trim().max(200).regex(/^[^\p{Cc}]*$/u).optional();
export const planSchema = z.array(z.object({ id: webflowIdSchema, name: z.string().max(255), types: typesSchema.optional(), placeholders: z.boolean().optional(), searchText: searchTextSchema, searchOptions: searchOptionsSchema.optional() })).max(SCAN_LIMITS.collections);
export const occurrenceInputSchema = z.object({
  collection_id: webflowIdSchema, collection_name: z.string().max(255),
  item_id: webflowIdSchema, item_name: z.string().max(255),
  locale: z.string().max(100), field_slug: z.string().min(1).max(100),
  field_name: z.string().max(255), field_type: z.enum(["PlainText", "Number", "Link", "RichText", "Image", "ImageRef", "MultiImage"]),
  source_value: z.string().max(SCAN_LIMITS.fieldLength), raw_match: z.string().min(1).max(SCAN_LIMITS.fieldLength),
  start_pos: z.number().int().min(0), end_pos: z.number().int().min(1),
  canonical: managedValueSchema,
});
export const occurrenceSchema = occurrenceInputSchema.extend({ id: z.uuid(), scan_id: z.uuid(), site_id: z.uuid(), source_key: z.string() });
export type DetectedOccurrence = z.infer<typeof occurrenceInputSchema>;
export type Occurrence = z.infer<typeof occurrenceSchema>;
export const scanSchema = z.object({
  id: z.uuid(), site_id: z.uuid(), workspace_id: z.uuid(), actor_id: z.uuid(), connection_id: z.uuid(),
  status: z.enum(["preview", "running", "paused", "completed", "limited", "cancelled"]),
  item_limit: z.number().int().min(1).max(500).optional(),
  plan: planSchema, collection_index: z.number().int(), item_offset: z.number().int(),
  revision: z.number().int(), items_read: z.number().int(), occurrences_count: z.number().int(),
  truncated: z.boolean(), skipped_fields: z.number().int(), error_code: z.string().nullable(),
  retry_at: z.string().nullable(), expires_at: z.string(), created_at: z.string(),
});
export type Scan = z.infer<typeof scanSchema>;
export const previewScanSchema = z.strictObject({ id: z.uuid(), siteId: z.uuid(), source: z.literal("cms"), collectionIds: z.array(webflowIdSchema).min(1).max(SCAN_LIMITS.collections), types: typesSchema, placeholders: z.boolean().optional(), searchText: searchTextSchema, searchOptions: searchOptionsSchema.optional() });
export const confirmScanSchema = z.strictObject({ id: z.uuid(), confirmed: z.literal("yes") });
export const processScanSchema = z.strictObject({ id: z.uuid(), revision: z.number().int().nonnegative() });
export const valuePreviewInputSchema = z.strictObject({
  id: z.uuid(), scanId: z.uuid(), name: z.string().trim().min(2).max(80).regex(/^[^\p{Cc}]+$/u),
  occurrenceIds: z.array(z.uuid()).min(2).max(100),
});
export const valuePreviewSchema = z.object({
  id: z.uuid(), scan_id: z.uuid(), site_id: z.uuid(), name: z.string(),
  canonical: managedValueSchema, occurrence_ids: z.array(z.uuid()), managed_value_id: z.uuid().nullable(), expires_at: z.string(),
});
export const savedValueSchema = z.object({ archived_at: z.string().nullable().optional(), version: z.number().int().positive().default(1), id: z.uuid(), site_id: z.uuid(), name: z.string(), canonical: managedValueSchema, created_at: z.string() });
export function valueLabel(value: z.infer<typeof managedValueSchema>) {
  switch (value.type) {
    case "money": return value.currency + " " + value.amount;
    case "phone": return value.number;
    case "date": return value.date;
    case "number": return value.number;
    case "text": return value.text;
    case "link": case "image": return value.url;
  }
}
export function groupOccurrences(occurrences: Occurrence[], includeWithinField = false, includeSingles = false) {
  const groups = new Map<string, { label: string; type: string; occurrences: Occurrence[]; sourceCount: number }>();
  for (const occurrence of occurrences) {
    const key = JSON.stringify(occurrence.canonical);
    const group = groups.get(key) ?? { label: valueLabel(occurrence.canonical), type: occurrence.canonical.type, occurrences: [], sourceCount: 0 };
    group.occurrences.push(occurrence);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, sourceCount: new Set(group.occurrences.map((o) => o.source_key)).size }))
    .filter((group) => includeSingles || (includeWithinField ? group.occurrences.length >= 2 : group.sourceCount >= 2)).sort((a, b) => b.sourceCount - a.sourceCount);
}

export function searchedScanTypes(scan: Pick<Scan, "plan">) {
  const selected = new Set(scan.plan.flatMap((entry) => entry.types ?? ["money", "phone", "date", "number", "text"]));
  if (scan.plan.some(entry => (entry.types ?? ["text"]).includes("text") && numericSearchValue(entry.searchText) !== null)) selected.add("number");
  return detectionTypes.filter((type) => selected.has(type));
}

export function groupScanResults(scan: Pick<Scan, "plan">, occurrences: Occurrence[], available: Occurrence[]) {
  const selected = new Set(searchedScanTypes(scan));
  // Retain observed types even for older saved plans.
  occurrences.forEach((occurrence) => selected.add(occurrence.canonical.type));
  return detectionTypes.filter((type) => selected.has(type)).map((type) => {
    const rows = occurrences.filter((o) => o.canonical.type === type);
    const eligible = available.filter((o) => o.canonical.type === type);
    const duplicates = groupOccurrences(rows, true, true).filter(group => group.occurrences.length >= 2 ||
      type === "text" && scan.plan.some(entry => !!entry.searchText || entry.placeholders) ||
      type === "number" && group.occurrences.some(o => scan.plan.some(entry => entry.id === o.collection_id && numericSearchValue(entry.searchText) === group.label)));
    return { type, label: type === "text" && scan.plan.some(entry => entry.placeholders) ? "Textos de exemplo" : detectionLabels[type], occurrences: rows, duplicates, groups: groupOccurrences(eligible), boundCount: rows.length - eligible.length };
  });
}

export function valuePreviewValidationError(input: unknown): "name" | "selection" | "invalid" | null {
  const parsed = valuePreviewInputSchema.safeParse(input);
  if (parsed.success) return null;
  if (parsed.error.issues.some((issue) => issue.path[0] === "name")) return "name";
  if (parsed.error.issues.some((issue) => issue.path[0] === "occurrenceIds")) return "selection";
  return "invalid";
}
