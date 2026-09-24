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

export function countReviewedOccurrences(sections: ReturnType<typeof groupScanResults>, reviewedIds: string[]) {
  const ids = new Set(sections.flatMap(section => section.duplicates.flatMap(group => group.occurrences.map(o => o.id))));
  const reviewed = new Set(reviewedIds.filter(id => ids.has(id))).size;
  return { pending: ids.size - reviewed, reviewed, all: ids.size };
}

// Presentation partition only: write eligibility and binding protections stay authoritative.
export function withoutVariableFields(sections: ReturnType<typeof groupScanResults>, linkedValues: Record<string,unknown>) {
  return sections.map(section => ({...section, duplicates: section.duplicates.map(group => ({...group,
    occurrences: group.occurrences.filter(row => !linkedValues[row.source_key]),
  })).filter(group => group.occurrences.length > 0)}));
}
