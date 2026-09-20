import { z } from "zod";

export const searchOptionsSchema = z.strictObject({
  ignoreCase: z.boolean().default(false),
  ignoreAccents: z.boolean().default(false),
  wholeWord: z.boolean().default(false),
});
export type SearchOptions = z.infer<typeof searchOptionsSchema>;
export const exactSearch: SearchOptions = { ignoreCase: false, ignoreAccents: false, wholeWord: false };

function normalize(text: string, options: SearchOptions) {
  let result = options.ignoreAccents ? text.normalize("NFD").replace(/\p{M}/gu, "") : text;
  if (options.ignoreCase) result = result.toLowerCase();
  return result;
}
const word = /[\p{L}\p{N}\p{M}_]/u;
export function hasWordBoundaries(before: string, after: string) {
  return !word.test([...before].at(-1) ?? "") && !word.test([...after][0] ?? "");
}

// Return original UTF-16 ranges, even when accents/casing change normalized length.
// Never return only part of a grapheme (e.g. a base letter without its accent).
export function findTextMatches(source: string, term: string, input: Partial<SearchOptions> = {}) {
  const options = searchOptionsSchema.parse(input);
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const needle = [...segmenter.segment(term)].map(({ segment }) => normalize(segment, options)).join("");
  if (!needle.trim()) return [];
  const starts = new Map<number, number>();
  const ends = new Map<number, number>();
  let normalized = "";
  for (const { segment, index } of segmenter.segment(source)) {
    const value = normalize(segment, options);
    if (!value) continue;
    starts.set(normalized.length, index);
    normalized += value;
    ends.set(normalized.length, index + segment.length);
  }
  const matches: { start: number; end: number; raw: string }[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const at = normalized.indexOf(needle, cursor);
    if (at < 0) break;
    const start = starts.get(at), end = ends.get(at + needle.length);
    if (start !== undefined && end !== undefined && (!options.wholeWord ||
      hasWordBoundaries(source.slice(0, start), source.slice(end)))) {
      matches.push({ start, end, raw: source.slice(start, end) });
      cursor = at + needle.length;
    } else cursor = at + 1;
  }
  return matches;
}

export function searchOptionsLabel(input?: Partial<SearchOptions>) {
  const options = searchOptionsSchema.parse(input ?? {});
  return [options.ignoreCase ? "Ignora maiúsculas/minúsculas" : "Diferencia maiúsculas/minúsculas",
    options.ignoreAccents ? "Ignora acentos" : "Diferencia acentos",
    options.wholeWord ? "Palavra ou expressão inteira" : "Trecho em qualquer posição"].join(" · ");
}
