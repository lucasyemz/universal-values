import { detectMedia } from "./media";
import { replacementSchema } from "./replacement-schema";
import { z } from "zod";
import type { Occurrence } from "./schema";

export const reviewHistorySchema = z.object({
  id: z.uuid(), created_at: z.string(), reverts_request_id: z.string().nullable(),
  status: z.string().optional(),
  changes: z.array(z.object({ occurrenceId: z.string(), after: replacementSchema.optional() })),
  results: z.array(z.object({ sourceKey: z.string(), status: z.string(), message: z.string().optional(), actual: z.json().optional(), reviewedSource: z.string().optional() })),
});
export type ReviewedChange = { requestId: string; after: string; reverted: boolean; reversible: boolean; image?: { before: string; after: string } };
/** Historical verified results, never a claim about the live CMS. Newest request wins. */
export function reviewedChanges(occurrences: Occurrence[], requests: z.infer<typeof reviewHistorySchema>[]) {
  const history: Record<string, ReviewedChange> = {};
  for (const request of [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))) {
    for (const change of request.changes) {
      const occurrence = occurrences.find(o => o.id === change.occurrenceId);
      const result = occurrence && request.results.find(r => r.sourceKey === occurrence.source_key && ["applied", "already_applied"].includes(r.status));
      if (!result || history[change.occurrenceId]) continue;
      const after = result.reviewedSource ?? (typeof result.actual === "string" ? result.actual : result.actual !== undefined ? JSON.stringify(result.actual) : undefined);
      let imageAfter = change.after?.type === "image" ? change.after.url : undefined;
      if (occurrence?.canonical.type === "image" && ["Image", "ImageRef", "MultiImage"].includes(occurrence.field_type) && result.actual !== undefined) {
        const beforeMedia = detectMedia(occurrence.field_type, JSON.parse(occurrence.source_value));
        const actualMedia = detectMedia(occurrence.field_type, result.actual);
        const index = beforeMedia?.matches.findIndex(m => m.start === occurrence.start_pos && m.end === occurrence.end_pos) ?? -1;
        const match = actualMedia?.matches[index];
        if (match?.canonical.type === "image") imageAfter = match.canonical.url;
      }
      if (after !== undefined) history[change.occurrenceId] = { requestId: request.id, after, reverted: !!request.reverts_request_id, reversible: !request.reverts_request_id && result.status === "applied" && result.actual !== undefined, ...(occurrence?.canonical.type === "image" && change.after?.type === "image" ? { image: { before: occurrence.canonical.url, after: imageAfter ?? change.after.url } } : {}) };
    }
  }
  return history;
}

export function reviewOutcomes(occurrences: Occurrence[], requests: z.infer<typeof reviewHistorySchema>[]) {
  const outcomes: Record<string, {status: string; message?: string}> = {};
  for (const request of [...requests].sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))) {
    if (request.status === "preview") continue;
    for (const change of request.changes) {
      if (outcomes[change.occurrenceId]) continue;
      const occurrence = occurrences.find(o => o.id === change.occurrenceId);
      const result = occurrence && request.results.find(r => r.sourceKey === occurrence.source_key);
      const status = result?.status ?? request.status;
      if (status) outcomes[change.occurrenceId] = {status: request.reverts_request_id && result && ["applied", "already_applied"].includes(result.status) ? "reverted" : status, message: result?.message};
    }
  }
  return outcomes;
}

/** A bulk reversal must never include fields hidden by the current review filter. */
export function visibleRevertGroups(occurrences: Occurrence[], history: Record<string,ReviewedChange>, visibleIds: Set<string>) {
  const groups = new Map<string,Set<string>>();
  for (const occurrence of occurrences) {
    const change = history[occurrence.id];
    if (!visibleIds.has(occurrence.id) || !change?.reversible) continue;
    const sources = groups.get(change.requestId) ?? new Set<string>();
    sources.add(occurrence.source_key); groups.set(change.requestId,sources);
  }
  return [...groups].map(([requestId,sources])=>({requestId,sources:[...sources]}));
}
