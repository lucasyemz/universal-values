import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { buildFieldChanges } from "./change-plan";
import { prepareOccurrenceChanges } from "./changes";
import type { Occurrence } from "./schema";

function readable(source: string, rich: boolean, occurrences: Occurrence[] = []) {
  const ranges = occurrences.filter(o => [...source].slice(o.start_pos,o.end_pos).join("") === o.raw_match).map(o => ({
    start:[...source].slice(0,o.start_pos).join("").length,
    end:[...source].slice(0,o.end_pos).join("").length,
  }));
  if (!rich) return {text:source,matches:ranges};
  let text = "";
  const matches: {start:number;end:number}[] = [];
  const decode = (raw: string): string => {
    const read = (node: DefaultTreeAdapterMap["node"]): string => "value" in node ? node.value : "childNodes" in node ? node.childNodes.map(read).join("") : "";
    return read(parseFragment(raw));
  };
  const visit = (node: DefaultTreeAdapterMap["node"]): void => {
    if ("tagName" in node && ["script", "style", "template", "textarea", "title"].includes(node.tagName)) return;
    if ("value" in node) {
      const loc=node.sourceCodeLocation;
      if (loc) for (const range of ranges) {
        if (range.start >= loc.startOffset && range.end <= loc.endOffset) {
          const start=text.length+decode(source.slice(loc.startOffset,range.start)).length;
          matches.push({start,end:start+decode(source.slice(range.start,range.end)).length});
        }
      }
      text+=node.value;
      return;
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("tagName" in node && /^(p|div|li|h[1-6]|blockquote|br)$/.test(node.tagName)) text+="\n";
  };
  visit(parseFragment(source,{sourceCodeLocationInfo:true}));
  const leading=text.length-text.trimStart().length;
  const trimmed=text.trim();
  return {text:trimmed,matches:matches.map(m=>({start:Math.max(0,m.start-leading),end:Math.min(trimmed.length,m.end-leading)})).filter(m=>m.end>m.start)};
}

// Same exact-range replacement builder as confirmation; no provider or persistence work.
export function liveTextPreview(selected: Occurrence[], inputs: Record<string, string>) {
  const text = selected.filter(o => o.canonical.type === "text");
  const draft = prepareOccurrenceChanges(text, inputs);
  if (Object.keys(draft.errors).length) return {fields: [], error: "Corrija os campos indicados antes de continuar."};
  try {
    const changed = draft.changes.length ? buildFieldChanges(text, draft.changes.map(({occurrenceId, after}) => ({occurrenceId, after}))) : [];
    const fields = [...new Map(text.map(o => [o.source_key, o])).values()].map(o => {
      const field = changed.find(f => f.sourceKey === o.source_key);
      const before=readable(o.source_value,o.field_type==="RichText",text.filter(row=>row.source_key===o.source_key));
      return {sourceKey:o.source_key, item:o.item_name, field:o.field_name, rawBefore:o.source_value, rawAfter:field ? String(field.after) : o.source_value, before:before.text, matches:before.matches, after:readable(field ? String(field.after) : o.source_value,o.field_type==="RichText").text};
    });
    return {fields, error:null};
  } catch {
    return {fields:[], error:"Trechos conflitantes. Execute outro scan."};
  }
}
