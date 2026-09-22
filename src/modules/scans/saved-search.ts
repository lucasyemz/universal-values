import { z } from "zod";
import { groupScanResults, searchedScanTypes, valueLabel, type Occurrence, scanSchema } from "./schema";
import { numericSearchValue } from "./numeric-search";

export const savedQuerySchema = z.string().trim().max(200).regex(/^[^\p{Cc}]*$/u).catch("");
export const savedScanSchema = scanSchema.pick({ id: true, site_id: true, actor_id: true, status: true, plan: true, created_at: true, truncated: true, skipped_fields: true });
export type SavedScan = z.infer<typeof savedScanSchema>;
const folded = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en");
export function savedTypeHint(query: string) {
  if (/^https?:\/\//i.test(query)) return "link";
  if (/^R\$\s*\d/.test(query)) return "money";
  if (/^(\+\d[\d ()-]{6,}|\(\d{2}\)\s*\d[\d -]{6,})$/.test(query)) return "phone";
  if (numericSearchValue(query) !== null) return "number";
  return "text";
}
export function compatibleSavedScan(scan: SavedScan, query: string) {
  if (!["completed", "limited"].includes(scan.status)) return false;
  const type = savedTypeHint(query);
  return searchedScanTypes(scan).includes(type) && scan.plan.some(entry => {
    const types = entry.types ?? ["money", "phone", "date", "number", "text"];
    if (type === "number" && numericSearchValue(entry.searchText) === numericSearchValue(query)) return true;
    if (!types.includes(type)) return false;
    return type !== "text" || !entry.searchText || folded(entry.searchText) === folded(query);
  });
}
// Lookup only. Never create new ranges, change canonical values, or match source context.
export function savedMatches(scan: SavedScan, occurrences: Occurrence[], query: string) {
  const type = savedTypeHint(query);
  return groupScanResults(scan, occurrences, occurrences).flatMap(section => section.duplicates).filter(group => {
    if (group.type !== type) return false;
    if (type === "link") return group.label === query;
    if (type === "number") return group.label === numericSearchValue(query);
    if (type === "phone") return group.occurrences.some(row => row.raw_match === query || valueLabel(row.canonical) === query);
    if (type === "money") return group.occurrences.some(row => row.raw_match === query);
    return folded(group.label) === folded(query);
  }).map(group => ({ label: group.label, count: group.occurrences.length, key: JSON.stringify(group.occurrences[0]!.canonical) }));
}

export const savedGroupSchema = z.string().max(5000).catch("");
export function filterSavedGroup(sections: ReturnType<typeof groupScanResults>, key: string) {
  if (!key) return sections;
  return sections.map(section => ({ ...section, duplicates: section.duplicates.filter(group => JSON.stringify(group.occurrences[0]?.canonical) === key) }));
}
