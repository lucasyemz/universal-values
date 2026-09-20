import type { SearchOptions } from "@/modules/text-search/match";
import { z } from "zod";
import { managedValueSchema, type ManagedValue } from "@/modules/managed-values/schema";
import { collectionDetailsSchema, itemsSchema } from "@/connectors/webflow/schemas";
import { SCAN_LIMITS, detectionTypes, type DetectedOccurrence } from "./schema";
import { detectMedia } from "./media";
import { detectTextMentions } from "./text-mentions";

type Match = { start: number; end: number; raw: string; canonical: ManagedValue };
export function detectText(text: string): Match[] {
  const matches: Match[] = [];
  const add = (start: number, raw: string, value: unknown) => {
    const canonical = managedValueSchema.safeParse(value);
    const end = start + raw.length;
    if (!canonical.success || matches.some((m) => start < m.end && end > m.start)) return;
    matches.push({ start, end, raw, canonical: canonical.data });
  };
  for (const match of text.matchAll(/(?<![\w-])R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?(?![\d.,])/g)) {
    const amount = match[0].replace(/^R\$\s*/, "").replaceAll(".", "").replace(",", ".");
    const [integer, fraction = "00"] = amount.split(".");
    add(match.index, match[0], { type: "money", currency: "BRL", amount: (integer!.replace(/^0+(?=\d)/, "")) + "." + fraction });
  }
  for (const match of text.matchAll(/(?<!\d)(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})(?!\d)/g)) {
    const date = match[0].includes("/") ? match[0].split("/").reverse().join("-") : match[0];
    add(match.index, match[0], { type: "date", date });
  }
  for (const match of text.matchAll(/(?<!\d)(?:\+\d[\d ()-]{5,24}\d|\(\d{2}\)[ ]*\d{4,5}[- ]?\d{4})(?!\d)/g)) {
    const digits = match[0].replace(/\D/g, "");
    add(match.index, match[0], { type: "phone", number: match[0].startsWith("+") ? "+" + digits : "+55" + digits });
  }
  if (!matches.length && text.trim().length >= 2 && text.trim().length <= 200) {
    const raw = text.trim();
    add(text.indexOf(raw), raw, { type: "text", text: raw });
  }
  // PostgreSQL positions count Unicode code points, not JavaScript UTF-16 units.
  return matches.sort((a, b) => a.start - b.start).map((m) => ({
    ...m, start: [...text.slice(0, m.start)].length, end: [...text.slice(0, m.end)].length,
  }));
}

export function detectPage(collection: z.infer<typeof collectionDetailsSchema>, page: z.infer<typeof itemsSchema>, types: readonly ManagedValue["type"][] = detectionTypes, searchText?: string, searchOptions?: SearchOptions) {
  const rows: DetectedOccurrence[] = [];
  let skippedFields = 0;
  let truncated = false;
  for (const item of page.items) {
    if (item.isArchived) continue;
    for (const field of collection.fields) {
      if (!["PlainText", "Number", "Link", "RichText", "Image", "ImageRef", "MultiImage"].includes(field.type) || field.slug === "slug") continue;
      const isMedia = !["PlainText", "Number"].includes(field.type);
      const mentions = !!searchText && types.includes("text") && ["PlainText", "RichText"].includes(field.type);
      if (isMedia && !mentions && !types.some((t) => t === "image" || t === "link")) continue;
      const value = item.fieldData[field.slug];
      if (value === undefined || value === null || value === "") continue;
      const media = isMedia ? detectMedia(field.type, value) : null;
      const source = isMedia ? media?.source ?? "" : typeof value === "string" || typeof value === "number" ? String(value) : "";
      if (!source || source.length > SCAN_LIMITS.fieldLength) { skippedFields++; truncated = true; continue; }
      let matches: Match[] = [];
      if (isMedia) matches = media?.matches ?? [];
      else if (field.type === "Number") {
        if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) { skippedFields++; truncated = true; continue; }
        const canonical = managedValueSchema.safeParse({ type: "number", number: Object.is(value, -0) ? "0" : source });
        if (!canonical.success) { skippedFields++; truncated = true; continue; }
        matches = [{ start: 0, end: source.length, raw: source, canonical: canonical.data }];
      } else if (typeof value === "string") matches = detectText(value);
      else { skippedFields++; truncated = true; continue; }
      if (mentions) {
        const found = detectTextMentions(source, searchText!, field.type === "RichText", searchOptions);
        matches = [...found, ...matches.filter((match) => match.canonical.type !== "text" && !found.some((m) => m.start < match.end && m.end > match.start))].sort((a, b) => a.start - b.start);
      }
      matches = matches.filter((match) => types.includes(match.canonical.type));
      if (matches.length > SCAN_LIMITS.matchesPerField) truncated = true;
      for (const match of matches.slice(0, SCAN_LIMITS.matchesPerField)) {
        if (rows.length >= SCAN_LIMITS.batchOccurrences) { truncated = true; break; }
        rows.push({
          collection_id: collection.id, collection_name: collection.displayName.slice(0, 255),
          item_id: item.id, item_name: String(item.fieldData.name ?? item.id).slice(0, 255),
          locale: item.cmsLocaleId ?? "", field_slug: field.slug, field_name: field.displayName.slice(0, 255),
          field_type: field.type as DetectedOccurrence["field_type"], source_value: source,
          raw_match: match.raw, start_pos: match.start, end_pos: match.end, canonical: match.canonical,
        });
      }
    }
  }
  return { rows, skippedFields, truncated };
}
