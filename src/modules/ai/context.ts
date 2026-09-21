import type { z } from "zod";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import type { collectionDetailsSchema, itemsSchema } from "@/connectors/webflow/schemas";
import type { Occurrence } from "@/modules/scans/schema";
import { textContext } from "@/modules/scans/text-context";
import { isPlaceholder, type AiContext } from "./schema";
function plainText(source: string) {
  const visit = (node: DefaultTreeAdapterMap["node"]): string => {
    if ("tagName" in node && ["script","style","template","iframe"].includes(node.tagName)) return "";
    if ("value" in node) return node.value;
    return "childNodes" in node ? node.childNodes.map(visit).join(" ") : "";
  };
  return visit(parseFragment(source)).replace(/\s+/g," ").trim();
}
export function buildAiContext(occurrence: Occurrence, collection: z.infer<typeof collectionDetailsSchema>, item: z.infer<typeof itemsSchema>["items"][number]): AiContext {
  if (occurrence.canonical.type !== "text" || !["PlainText","RichText"].includes(occurrence.field_type)) throw new Error("Somente texto pode receber sugestões.");
  if (collection.id !== occurrence.collection_id || item.id !== occurrence.item_id || (item.cmsLocaleId ?? "") !== occurrence.locale || item.isArchived) throw new Error("A origem mudou. Execute um novo scan.");
  if (item.fieldData[occurrence.field_slug] !== occurrence.source_value) throw new Error("O campo mudou desde o scan. Execute um novo scan antes de gerar a sugestão.");
  if (!collection.fields.some(field => field.slug === occurrence.field_slug && field.type === occurrence.field_type)) throw new Error("O campo mudou. Execute um novo scan.");
  const context = textContext(occurrence);
  if (!context) throw new Error("Trecho indisponível. Execute um novo scan.");
  const facts: string[] = [];
  for (const field of collection.fields) {
    if (field.slug === occurrence.field_slug || field.slug === "slug" || !["PlainText","RichText","Number","Switch"].includes(field.type)) continue;
    const raw = item.fieldData[field.slug];
    if (!["string","number","boolean"].includes(typeof raw)) continue;
    if (typeof raw === "string" && raw.length > 10000) continue;
    const value = field.type === "RichText" ? plainText(String(raw)) : String(raw).trim();
    if (!value || isPlaceholder(value)) continue;
    facts.push(`${field.displayName.slice(0,100)}: ${value.slice(0,500)}`);
    if (facts.length >= 8) break;
  }
  return { collection: collection.displayName.slice(0,255), item: String(item.fieldData.name ?? occurrence.item_name).slice(0,255), field: occurrence.field_name,
    original: occurrence.raw_match, surrounding: `${context.before}[TRECHO A SUBSTITUIR]${context.after}`, facts: facts.join("\n").slice(0,4000) };
}
