import type { Occurrence } from "./schema";

export type LinkedValues = Record<string, { id: string; name: string }>;
export function centralizationOptions(occurrences: Occurrence[], linkedValues: LinkedValues) {
  const available = occurrences.filter(o => !linkedValues[o.source_key]);
  return { available, eligible: new Set(available.map(o => o.source_key)).size >= 2 };
}
