import { z } from "zod";
import { type ManagedValue } from "@/modules/managed-values/schema";
import { replacementSchema } from "./replacement-schema";
import { type Occurrence } from "./schema";
import { editableValue } from "./changes";
import { detectTextMentions } from "./text-mentions";

export const changesSchema = z.array(z.strictObject({ occurrenceId: z.uuid(), after: replacementSchema })).min(1).max(1000)
  .refine((rows) => new Set(rows.map((r) => r.occurrenceId)).size === rows.length, "Ocorrências duplicadas.");
type FieldValue = z.infer<ReturnType<typeof z.json>>;
export type FieldChange = { sourceKey: string; occurrence: Occurrence; before: FieldValue; after: FieldValue; occurrenceIds: string[] };
const escapeAttribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function replacement(o: Occurrence, after: ManagedValue) {
  if (o.canonical.type !== after.type) throw new Error("O tipo do valor não pode mudar.");
  if (o.field_type === "RichText") {
    if (after.type === "text") {
      if (!detectTextMentions(o.source_value, o.raw_match, true).some((m) => m.start === o.start_pos && m.end === o.end_pos)) throw new Error("Trecho de texto HTML inválido.");
      return escapeAttribute(after.text);
    }
    if (after.type !== "link" && after.type !== "image") throw new Error("Tipo incompatível com HTML.");
    const attr = after.type === "link" ? "href" : "src";
    if (!new RegExp("^" + attr + "\\s*=", "i").test(o.raw_match)) throw new Error("Trecho HTML inválido.");
    return attr + '="' + escapeAttribute(after.url) + '"';
  }
  if (["Image", "ImageRef", "MultiImage"].includes(o.field_type)) {
    if (after.type !== "image") throw new Error("Imagem inválida.");
    const old = z.object({ alt: z.string().nullable().optional() }).parse(JSON.parse(o.raw_match));
    return JSON.stringify({ url: after.url, ...(old.alt !== undefined && old.alt !== null ? { alt: old.alt } : {}) });
  }
  if (after.type === "money") {
    if (o.canonical.type !== "money" || after.currency !== o.canonical.currency || after.currency !== "BRL") throw new Error("A moeda deve ser mantida.");
    return "R$ " + after.amount.replace(".", ",");
  }
  if (after.type === "date" && o.raw_match.includes("/")) return after.date.split("-").reverse().join("/");
  return editableValue(after);
}

export function buildFieldChanges(occurrences: Occurrence[], input: unknown): FieldChange[] {
  const changes = changesSchema.parse(input);
  const byId = new Map(occurrences.map((o) => [o.id, o]));
  const groups = new Map<string, { o: Occurrence; after: ManagedValue }[]>();
  for (const change of changes) {
    const o = byId.get(change.occurrenceId);
    if (!o) throw new Error("Ocorrência indisponível.");
    if (JSON.stringify(o.canonical) === JSON.stringify(change.after)) continue;
    const rows = groups.get(o.source_key) ?? [];
    rows.push({ o, after: change.after }); groups.set(o.source_key, rows);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sourceKey, entries]) => {
    const occurrence = entries[0]!.o;
    const source = [...occurrence.source_value];
    let end = source.length;
    for (const { o, after } of entries.sort((a, b) => b.o.start_pos - a.o.start_pos)) {
      if (o.source_value !== occurrence.source_value || o.end_pos > end || source.slice(o.start_pos, o.end_pos).join("") !== o.raw_match) throw new Error("Trechos conflitantes. Execute outro scan.");
      source.splice(o.start_pos, o.end_pos - o.start_pos, ...replacement(o, after)); end = o.start_pos;
    }
    const text = source.join("");
    let before: FieldValue = occurrence.source_value;
    let after: FieldValue = text;
    if (["Image", "ImageRef", "MultiImage"].includes(occurrence.field_type)) { before = z.json().parse(JSON.parse(occurrence.source_value)); after = z.json().parse(JSON.parse(text)); }
    if (occurrence.field_type === "Number") {
      before = Number(occurrence.source_value); after = Number(text);
      if (!Number.isFinite(after) || Math.abs(after) > Number.MAX_SAFE_INTEGER || String(after) !== text) throw new Error("Número fora da precisão suportada.");
    }
    if (text.length > 20000) throw new Error("Campo resultante excede 20.000 caracteres.");
    return { sourceKey, occurrence, before, after, occurrenceIds: entries.map((e) => e.o.id) };
  });
}

export function sameField(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameField(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>; const right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every((key) => Object.hasOwn(right, key) && sameField(left[key], right[key]));
  }
  return false;
}
