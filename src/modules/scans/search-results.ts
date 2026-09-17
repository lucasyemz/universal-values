import { z } from "zod";
import { type groupScanResults } from "./schema";
import { occurrencePresentation } from "./presentation";

export const resultsSearchSchema = z.string().trim().max(200).catch("");

export function searchResultGroups(sections: ReturnType<typeof groupScanResults>, query: string) {
  const term = query.normalize("NFC").toLocaleLowerCase("pt-BR");
  if (!term) return sections;
  // Keep exact-value groups intact: searching never combines different business values.
  return sections.map((section) => ({ ...section, duplicates: section.duplicates.filter((group) =>
    [group.label, ...group.occurrences.map((o) => occurrencePresentation(o).title)]
      .some((text) => text.normalize("NFC").toLocaleLowerCase("pt-BR").includes(term)),
  ) }));
}
