import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { valueLabel, type Occurrence } from "./schema";
import { textContext } from "./text-context";

type Node = DefaultTreeAdapterMap["node"];
function textContent(node: Node): string {
  if ("tagName" in node && ["script", "style", "template"].includes(node.tagName)) return "";
  if ("value" in node) return node.value;
  if ("tagName" in node && node.tagName === "img") return node.attrs.find((a) => a.name === "alt")?.value ?? "";
  return "childNodes" in node ? node.childNodes.map(textContent).join("") : "";
}

export function occurrencePresentation(o: Pick<Occurrence, "canonical" | "field_type" | "field_name" | "source_value" | "start_pos" | "end_pos" | "raw_match">) {
  const media = o.canonical.type === "link" || o.canonical.type === "image";
  let title = media ? o.field_name : valueLabel(o.canonical);
  if (media && o.field_type === "RichText") {
    const visit = (node: Node) => {
      if ("tagName" in node) {
        if (["script", "style", "template"].includes(node.tagName)) return;
        const attr = o.canonical.type === "link" ? "href" : "src";
        const expectedTag = o.canonical.type === "link" ? "a" : "img";
        const loc = node.sourceCodeLocation?.attrs?.[attr];
        if (node.tagName === expectedTag && loc && [...o.source_value.slice(0, loc.startOffset)].length === o.start_pos) {
          const label = textContent(node).trim() || node.attrs.find((a) => a.name === "aria-label")?.value || node.attrs.find((a) => a.name === "title")?.value;
          if (label) title = label;
        }
      }
      if ("childNodes" in node) node.childNodes.forEach(visit);
    };
    visit(parseFragment(o.source_value, { sourceCodeLocationInfo: true }));
  } else if (o.canonical.type === "image") {
    try {
      const image: unknown = JSON.parse(o.raw_match);
      if (image && typeof image === "object" && "alt" in image && typeof image.alt === "string" && image.alt.trim()) title = image.alt;
    } catch { /* Older snapshots may contain only a URL; use the field name. */ }
  }
  return {
    title: title.replace(/\s+/g, " ").trim(),
    subtitle: media ? valueLabel(o.canonical) : null,
    imageUrl: o.canonical.type === "image" ? o.canonical.url : null,
    context: o.canonical.type === "text" ? textContext(o) : null,
  };
}
