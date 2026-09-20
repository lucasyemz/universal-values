import { findTextMatches } from "@/modules/text-search/match";
import { z } from "zod";
import { type groupScanResults } from "./schema";
import { occurrencePresentation } from "./presentation";

export const resultsSearchSchema = z.string().trim().max(200).catch("");

export function searchResultGroups(sections: ReturnType<typeof groupScanResults>, query: string) {
  const term = query.trim();
  if (!term) return sections;
  // Keep exact-value groups intact: searching never combines different business values.
  return sections.map((section) => ({ ...section, duplicates: section.duplicates.filter((group) =>
    [group.label, ...group.occurrences.flatMap((o) => {
      const display = occurrencePresentation(o);
      return [display.title, o.collection_name, o.item_name, o.field_name, display.context?.full ?? ""];
    })].some((text) => !!text && findTextMatches(text, term, { ignoreCase: true, ignoreAccents: true }).length > 0),
  ) }));
}
