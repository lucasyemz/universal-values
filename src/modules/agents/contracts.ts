import { z } from "zod";

export const MAX_RESPONSE_BYTES = 32 * 1024;
export const MAX_REQUEST_BYTES = 16 * 1024;
const slug = z.string().min(1).max(110).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const page = z.number().int().min(1).max(1000).default(1);
const site = { account: slug, site: slug };
export const toolInputs = {
  list_sites: z.strictObject({ after: slug.optional() }),
  get_site_summary: z.strictObject(site),
  search_saved_content: z.strictObject({ ...site, query: z.string().trim().min(1).max(200).regex(/^[^\p{Cc}]*$/u) }),
  list_managed_values: z.strictObject({ ...site, before: z.number().int().positive().max(999999999999999).optional() }),
  get_managed_value: z.strictObject({ ...site, value: z.number().int().positive().max(999999999999999) }),
  get_scan_results: z.strictObject({ ...site, scan: z.number().int().positive().max(999999999999999), page }),
  list_recent_changes: z.strictObject({ ...site, cursor: z.strictObject({ at: z.iso.datetime({ offset: true }), number: z.number().int().positive().max(999999999999999), source: z.enum(["cms", "static"]) }).optional() }),
};
export type ToolName = keyof typeof toolInputs;
export const toolNames = Object.keys(toolInputs) as ToolName[];
export const errorCodes = ["AUTH_REQUIRED", "ACCESS_PAUSED", "SITE_NOT_FOUND", "SCAN_NOT_FOUND", "SCAN_NOT_READY", "VALUE_NOT_FOUND", "RATE_LIMITED", "INVALID_INPUT", "RESPONSE_TOO_LARGE", "UNAVAILABLE"] as const;
export const errorSchema = z.object({ error: z.enum(errorCodes), retryAfter: z.number().optional() });
export class AgentError extends Error {
  constructor(public readonly code: typeof errorCodes[number], public readonly retryAfter?: number) { super(code); }
}
export function checkedPayload(value: Record<string, unknown>) {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_RESPONSE_BYTES) throw new AgentError("RESPONSE_TOO_LARGE");
  return value;
}
export const descriptions: Record<ToolName, string> = {
  list_sites: "List sites in the token's workspace. Persisted data only; no provider calls.",
  get_site_summary: "Saved site counts and recent attention summary, not a live site health check.",
  search_saved_content: "Find exact saved groups in the latest compatible completed/limited scan among the last 20. No match only means no matching saved occurrence. Never starts a scan.",
  list_managed_values: "List saved central values and source counts. Does not verify live sources.",
  get_managed_value: "Read a central value, version and saved source uncertainty. No binding snapshots or live refresh.",
  get_scan_results: "Read paginated ORIGINAL saved observations with exact ranges and aggregate review counts. Not current CMS content or edit authorization. Open dashboard for current applied/reverted details.",
  list_recent_changes: "Read saved CMS/static change summaries. No live verification or execution.",
};
