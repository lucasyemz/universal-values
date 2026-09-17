import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { z } from "zod";
import { managedValueSchema, type ManagedValue } from "@/modules/managed-values/schema";

type MediaMatch = { start: number; end: number; raw: string; canonical: ManagedValue };
const imageSchema = z.object({ url: z.string(), fileId: z.string().optional(), alt: z.string().nullable().optional() });

// Keep full snapshots and exact spans; HTML is parsed, never rendered or fetched.
export function detectMedia(fieldType: string, value: unknown): { source: string; matches: MediaMatch[] } | null {
  const matches: MediaMatch[] = [];
  let source = "";
  const add = (type: "image" | "link", url: string, start: number, end: number) => {
    const canonical = managedValueSchema.safeParse({ type, url });
    if (!canonical.success) return;
    matches.push({ canonical: canonical.data, raw: source.slice(start, end), start: [...source.slice(0, start)].length, end: [...source.slice(0, end)].length });
  };
  if (fieldType === "Link") {
    if (typeof value !== "string") return null;
    source = value;
    add("link", value, 0, source.length);
  } else if (fieldType === "RichText") {
    if (typeof value !== "string") return null;
    source = value;
    if (source.length > 2000) return { source, matches };
    const visit = (node: DefaultTreeAdapterMap["node"]) => {
      if ("tagName" in node) {
        if (["script", "style", "template"].includes(node.tagName)) return;
        const attrName = node.tagName === "a" ? "href" : node.tagName === "img" ? "src" : null;
        if (attrName) {
          const attr = node.attrs.find((a) => a.name === attrName);
          const loc = node.sourceCodeLocation?.attrs?.[attrName];
          if (attr && loc) add(node.tagName === "a" ? "link" : "image", attr.value, loc.startOffset, loc.endOffset);
        }
      }
      if ("childNodes" in node) node.childNodes.forEach(visit);
    };
    visit(parseFragment(source, { sourceCodeLocationInfo: true }));
  } else {
    const images = fieldType === "MultiImage" ? z.array(imageSchema).safeParse(value) : imageSchema.safeParse(value);
    if (!images.success) return null;
    const entries = Array.isArray(images.data) ? images.data : [images.data];
    // Serialize the original payload, retaining metadata for future conflict checks.
    source = JSON.stringify(value);
    const originals = Array.isArray(value) ? value : [value];
    let cursor = 0;
    entries.forEach((entry, index) => {
      const raw = JSON.stringify(originals[index]);
      const start = source.indexOf(raw, cursor);
      if (start < 0) return;
      add("image", entry.url, start, start + raw.length);
      cursor = start + raw.length;
    });
  }
  return { source, matches };
}
