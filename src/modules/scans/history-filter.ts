import type { Scan } from "./schema";
export type ScanReviewCounts = { pending: number; reviewed: number };
export function filterScanHistory<T extends Pick<Scan, "id" | "plan">>(scans: T[], counts: Record<string, ScanReviewCounts | null>, labels: Record<string,string>, query: string, filter: "all" | "pending" | "reviewed") {
 const needle = query.trim().toLocaleLowerCase();
 return scans.filter(scan => {
  const count = counts[scan.id];
  if (filter === "pending" && (!count || count.pending === 0)) return false;
  if (filter === "reviewed" && (!count || count.pending !== 0)) return false;
  const text = [labels[scan.id], ...scan.plan.flatMap(entry => [entry.name, entry.searchText ?? ""])].join(" ").toLocaleLowerCase();
  return !needle || text.includes(needle);
 });
}
