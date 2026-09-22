import { withAppliedSources } from "./applied-source";
import "server-only";
import { z } from "zod";
import type { requireUser } from "@/modules/auth/service";
import type { Scan, Occurrence } from "./schema";
import { reviewedChanges, reviewOutcomes, reviewHistorySchema } from "./review-history";

// Callers authorize the scan or its site first; queries also use the authenticated client.
export async function loadReviewState(client: Awaited<ReturnType<typeof requireUser>>["client"], scan: Pick<Scan,"id"|"actor_id">, occurrences: Occurrence[]) {
  const id = scan.id;
  const reviews = await client.rpc("scan_reviewed_occurrences", { p_scan_id: id });
  const reviewsMissing = !!reviews.error && ["PGRST202", "42883"].includes(reviews.error.code);
  if (reviews.error && !reviewsMissing) throw new Error("Marcações de revisão indisponíveis.");
  const requests = [];
  for (let offset = 0; ; offset += 200) {
    const page = await client.from("cms_change_requests")
      .select("id,created_at,status,reverts_request_id,changes,results")
      .eq("scan_id", id).eq("actor_id", scan.actor_id)
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 199);
    if (page.error) throw new Error("Histórico de alterações indisponível.");
    const rows = z.array(reviewHistorySchema).parse(page.data);
    requests.push(...rows);
    if (rows.length < 200) break;
  }
  const reviewHistory = reviewedChanges(occurrences, requests);
  const reviewedIds = [...new Set([...z.array(z.object({ occurrence_id: z.uuid() })).parse(reviews.data ?? []).map((row) => row.occurrence_id), ...Object.keys(reviewHistory)])];
  const currentOccurrences = withAppliedSources(occurrences, [...requests].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).filter(r => ["completed", "cancelled"].includes(r.status ?? "") && !r.reverts_request_id).map(r => ({...r, changes: r.changes.filter((c): c is typeof c & {after: NonNullable<typeof c.after>} => !!c.after)})));
  const outcomes = reviewOutcomes(occurrences, requests);
  // A conflict against the old scan can be superseded by a proven local baseline.
  for (const row of currentOccurrences) {
    const original = occurrences.find(o => o.id === row.id);
    if (outcomes[row.id]?.status === "conflict" && original?.source_value !== row.source_value) delete outcomes[row.id];
  }
  return {currentOccurrences, reviewedIds, reviewHistory, reviewsMissing, outcomes};
}
