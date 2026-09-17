import { z } from "zod";
import { type groupScanResults } from "./schema";

export const reviewFilterSchema = z.enum(["pending", "reviewed", "all"]);
export const reviewFilterLabels = { pending: "Pendentes", reviewed: "Revisados", all: "Todos" };
export function filterReviewedGroups(sections: ReturnType<typeof groupScanResults>, reviewedIds: string[], filter: z.infer<typeof reviewFilterSchema>) {
  const reviewed = new Set(reviewedIds);
  return sections.map((section) => ({ ...section, duplicates: section.duplicates.map((group) => ({
    ...group,
    // Group first, filter second: a new source remains visible even if its peers were reviewed.
    occurrences: group.occurrences.filter((o) => filter === "all" || reviewed.has(o.id) === (filter === "reviewed")),
  })).filter((group) => group.occurrences.length > 0) }));
}
