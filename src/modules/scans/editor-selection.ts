import type { Occurrence } from "./schema";
import { prepareOccurrenceChanges } from "./changes";

/** Selection only narrows the already-authorized editable occurrences. */
export function selectedOccurrenceChanges(available: Occurrence[], selectedIds: string[], inputs: Record<string, string>) {
  const selected = new Set(selectedIds);
  const occurrences = available.filter(occurrence => selected.has(occurrence.id));
  return { occurrences, ...prepareOccurrenceChanges(occurrences, inputs) };
}
