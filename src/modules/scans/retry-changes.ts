import type { z } from "zod";
import type { changesSchema, FieldChange } from "./change-plan";

type Result = { sourceKey: string; status: string };
export function failedChangesForRetry(changes: z.infer<typeof changesSchema>, plan: FieldChange[], results: Result[]) {
  // Uncertain writes require reconciliation/new scan; never turn them into automatic retries.
  const failedSources = new Set(results.filter((result) => result.status === "failed").map((result) => result.sourceKey));
  const ids = new Set(plan.filter((field) => failedSources.has(field.sourceKey)).flatMap((field) => field.occurrenceIds));
  return changes.filter((change) => ids.has(change.occurrenceId));
}
