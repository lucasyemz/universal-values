import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import type { Occurrence } from "./schema";

type Node = DefaultTreeAdapterMap["node"];
const blocks = new Set(["p", "div", "li", "ul", "ol", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "tr"]);
function decodedText(source: string): string {
  const read = (node: Node): string => "value" in node ? node.value : "childNodes" in node ? node.childNodes.map(read).join("") : "";
  return read(parseFragment(source));
}

export function textContext(o: Pick<Occurrence, "source_value" | "start_pos" | "end_pos" | "raw_match" | "field_type">) {
  const chars = [...o.source_value];
  if (chars.slice(o.start_pos, o.end_pos).join("") !== o.raw_match) return null;
  let before = chars.slice(0, o.start_pos).join("");
  let after = chars.slice(o.end_pos).join("");
  if (o.field_type === "RichText") {
    const start = before.length;
    const end = start + o.raw_match.length;
    let text = "";
    let position: number | null = null;
    const visit = (node: Node) => {
      if ("tagName" in node && ["script", "style", "template", "textarea", "title"].includes(node.tagName)) return;
      if ("tagName" in node && (blocks.has(node.tagName) || node.tagName === "br")) text += "\n";
      if (node.nodeName === "#text" && "value" in node) {
        const loc = node.sourceCodeLocation;
        if (loc && start >= loc.startOffset && end <= loc.endOffset) {
          text += decodedText(o.source_value.slice(loc.startOffset, start));
          position = text.length;
          text += o.raw_match + decodedText(o.source_value.slice(end, loc.endOffset));
        } else text += node.value;
      }
      if ("childNodes" in node) node.childNodes.forEach(visit);
      if ("tagName" in node && blocks.has(node.tagName)) text += "\n";
    };
    visit(parseFragment(o.source_value, { sourceCodeLocationInfo: true }));
    if (position === null) return null;
    before = text.slice(0, position);
    after = text.slice(position + o.raw_match.length);
  }
  before = before.replace(/\s+/g, " ").trimStart();
  after = after.replace(/\s+/g, " ").trimEnd();
  const left = [...before];
  const right = [...after];
  return {
    before: left.slice(-90).join(""), match: o.raw_match, after: right.slice(0, 90).join(""),
    clippedBefore: left.length > 90, clippedAfter: right.length > 90,
    full: before + o.raw_match + after,
  };
}
