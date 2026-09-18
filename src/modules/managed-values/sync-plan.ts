import { createHash } from "node:crypto";
import { z } from "zod";
import { managedValueSchema, type ManagedValue } from "./schema";
import { occurrenceSchema, type Occurrence } from "@/modules/scans/schema";
import { buildFieldChanges, occurrenceReplacement, sameField, type FieldChange } from "@/modules/scans/change-plan";

export const locationsSchema = z.array(z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), raw: z.string().min(1).max(20000) })).min(1).max(1000);
export const bindingSchema = z.object({
  id: z.uuid(), managed_value_id: z.uuid(), site_id: z.uuid(), workspace_id: z.uuid(),
  source_key: z.string().min(1), collection_id: z.string().regex(/^[a-f\d]{24}$/i), item_id: z.string().regex(/^[a-f\d]{24}$/i),
  locale: z.string().max(100), field_slug: z.string().min(1).max(100),
  field_type: occurrenceSchema.shape.field_type, source_value: z.string().max(20000), locations: locationsSchema,
  canonical: managedValueSchema, uncertain: z.boolean(), last_synced_at: z.string().nullable(),
});
export const bindingsSchema = z.array(bindingSchema).min(1).max(1000)
  .refine(rows => new Set(rows.map(row => row.source_key)).size === rows.length, "Fontes duplicadas.");
export type ManagedBinding = z.infer<typeof bindingSchema>;
export type ManagedField = FieldChange & { binding: ManagedBinding; nextSource: string; nextLocations: z.infer<typeof locationsSchema> };
const managedOccurrenceSchema = occurrenceSchema.extend({ source_value: z.string().max(20000), raw_match: z.string().min(1).max(20000) });
function occurrenceId(bindingId: string, index: number) {
  const hex = createHash("sha256").update(bindingId + ":" + index).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function fieldValue(binding: ManagedBinding) {
  if (["Image", "ImageRef", "MultiImage"].includes(binding.field_type)) return z.json().parse(JSON.parse(binding.source_value));
  if (binding.field_type === "Number") return z.number().finite().parse(Number(binding.source_value));
  return binding.source_value;
}

// Snapshot-derived plan: never find/replace every similar string, only the
// locations explicitly linked by the user. Offsets are Unicode code points.
export function buildManagedSyncPlan(input: unknown, target: ManagedValue, requestId: string) {
  const bindings = bindingsSchema.parse(input);
  const after = managedValueSchema.parse(target);
  const occurrences: Occurrence[] = [];
  const changes: { occurrenceId: string; after: ManagedValue }[] = [];
  const plan: ManagedField[] = bindings.map(binding => {
    if (binding.canonical.type !== after.type || (binding.canonical.type === "money" && after.type === "money" && binding.canonical.currency !== after.currency)) throw new Error("O tipo e a moeda do valor devem ser mantidos.");
    const source = [...binding.source_value];
    let end = 0;
    const rows = binding.locations.map((location, index) => {
      if (location.start < end || location.end <= location.start || location.end > source.length || source.slice(location.start, location.end).join("") !== location.raw) throw new Error("Vínculo desatualizado ou com trechos sobrepostos.");
      end = location.end;
      return managedOccurrenceSchema.parse({ id: occurrenceId(binding.id, index), scan_id: requestId, site_id: binding.site_id,
        source_key: binding.source_key, collection_id: binding.collection_id, collection_name: binding.collection_id,
        item_id: binding.item_id, item_name: binding.item_id, locale: binding.locale, field_slug: binding.field_slug, field_name: binding.field_slug,
        field_type: binding.field_type, source_value: binding.source_value, raw_match: location.raw, start_pos: location.start, end_pos: location.end, canonical: binding.canonical });
    });
    occurrences.push(...rows);
    const edits = rows.map(row => ({ occurrenceId: row.id, after }));
    changes.push(...edits);
    const built = buildFieldChanges(rows, edits, { allowEncodedText: true });
    const field = built[0] ?? { sourceKey: binding.source_key, occurrence: rows[0]!, before: fieldValue(binding), after: fieldValue(binding), occurrenceIds: rows.map(row => row.id) };
    let shift = 0;
    const unchanged = sameField(binding.canonical, after);
    const nextLocations = rows.map(row => {
      const raw = unchanged ? row.raw_match : occurrenceReplacement(row, after, true);
      const start = row.start_pos + shift;
      const length = [...raw].length;
      shift += length - (row.end_pos - row.start_pos);
      return { start, end: start + length, raw };
    });
    // Keep the exact text representation used by the plan, including JSON field offsets.
    const nextChars = [...binding.source_value];
    for (let index = rows.length - 1; index >= 0; index--) {
      const row = rows[index]!;
      nextChars.splice(row.start_pos, row.end_pos - row.start_pos, ...nextLocations[index]!.raw);
    }
    const nextSource = nextChars.join("");
    if (nextSource.length > 20000) throw new Error("Campo resultante excede 20.000 caracteres.");
    return { ...field, binding, nextSource, nextLocations };
  }).sort((a, b) => a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0);
  if (changes.length > 1000) throw new Error("O Managed Value excede o limite de 1.000 ocorrências.");
  return { occurrences, changes, plan };
}
