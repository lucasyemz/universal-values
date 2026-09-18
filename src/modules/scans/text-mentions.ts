import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

// Persisted bindings can contain escaped text produced by a prior confirmed
// edit. Validate its exact range without re-discovering or widening the match.
export function isRichTextRange(source: string, start: number, end: number) {
  const chars = [...source];
  const from = chars.slice(0, start).join("").length;
  const to = chars.slice(0, end).join("").length;
  let found = false;
  const visit = (node: DefaultTreeAdapterMap["node"]) => {
    if ("tagName" in node && ["script", "style", "template", "textarea", "title"].includes(node.tagName)) return;
    if (node.nodeName === "#text" && node.sourceCodeLocation) {
      const { startOffset, endOffset } = node.sourceCodeLocation;
      if (from >= startOffset && to <= endOffset && from < to) {
        const entities = [...source.slice(startOffset, endOffset).matchAll(/&(?:#[xX][0-9a-fA-F]+;?|#\d+;?|[a-zA-Z][a-zA-Z0-9]*;?)/g)];
        found = !entities.some(entity => {
          const a = startOffset + entity.index, b = a + entity[0].length;
          return (from > a && from < b) || (to > a && to < b);
        });
      }
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  };
  visit(parseFragment(source, { sourceCodeLocationInfo: true }));
  return found;
}

// Match literal source text within text nodes, never HTML attributes or markup.
export function detectTextMentions(source: string, term: string, richText = false) {
  const matches: { start: number; end: number; raw: string; canonical: { type: "text"; text: string } }[] = [];
  if (!term) return matches;
  const search = (start: number, end: number) => {
    let index = source.indexOf(term, start);
    while (index >= start && index + term.length <= end) {
      matches.push({ start: [...source.slice(0, index)].length, end: [...source.slice(0, index + term.length)].length,
        raw: term, canonical: { type: "text", text: term } });
      index = source.indexOf(term, index + term.length);
    }
  };
  if (!richText) search(0, source.length);
  else {
    const visit = (node: DefaultTreeAdapterMap["node"]) => {
      if ("tagName" in node && ["script", "style", "template", "textarea", "title"].includes(node.tagName)) return;
      if (node.nodeName === "#text" && node.sourceCodeLocation) {
        const { startOffset, endOffset } = node.sourceCodeLocation;
        // Entity encodings cannot be treated as visible literal text.
        const raw = source.slice(startOffset, endOffset);
        let cursor = 0;
        for (const entity of raw.matchAll(/&(?:#[xX][0-9a-fA-F]+;?|#\d+;?|[a-zA-Z][a-zA-Z0-9]*;?)/g)) {
          search(startOffset + cursor, startOffset + entity.index);
          cursor = entity.index + entity[0].length;
        }
        search(startOffset + cursor, endOffset);
      }
      if ("childNodes" in node) node.childNodes.forEach(visit);
    };
    visit(parseFragment(source, { sourceCodeLocationInfo: true }));
  }
  return matches;
}
