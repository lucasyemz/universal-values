import type { Occurrence } from "./schema";

export type LinkedValues = Record<string, { id: string; name: string }>;
export function centralizationOptions(occurrences: Occurrence[], linkedValues: LinkedValues) {
  const available = occurrences.filter(o => !linkedValues[o.source_key]);
  return { available, eligible: new Set(available.map(o => o.source_key)).size >= 2 };
}

export function scanEditingOptions(occurrences: Occurrence[], linkedValues: LinkedValues, independentIds: string[]) {
  const independent = new Set(independentIds);
  const protectedIds = new Set(occurrences.filter(o => linkedValues[o.source_key] && !independent.has(o.id)).map(o => o.id));
  return { available: occurrences.filter(o => !protectedIds.has(o.id)), protectedIds };
}
