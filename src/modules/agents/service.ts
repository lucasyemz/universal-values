import { z } from "zod";
import { compatibleSavedScan, savedMatches, savedScanSchema, savedTypeHint } from "@/modules/scans/saved-search";
import { groupScanResults, occurrenceSchema, valueLabel } from "@/modules/scans/schema";
import { reviewSummarySchema, scanReviewSummary } from "@/modules/scans/list-summary";
import { managedValueSchema } from "@/modules/managed-values/schema";
import { resourcePath, sitePath } from "@/modules/routes/resources";
import { AgentError, checkedPayload, errorSchema, toolInputs, type ToolName } from "./contracts";

// Shared application service. Only this narrow repository is supplied by the transport.
export type ReadRepository = (action: string, args: Record<string, unknown>) => Promise<unknown>;
const clip = (s: string, n = 300) => s.length > n ? s.slice(0, n) + "…" : s;
const valueRow = z.object({ number: z.number().int().positive(), name: z.string(), canonical: managedValueSchema, version: z.number(), archived_at: z.string().nullable(), sources: z.number(), uncertain: z.boolean() });
const scanData = z.object({ scan: savedScanSchema, number: z.number().int().positive(), rows: z.array(occurrenceSchema.extend({ managed_field: z.boolean() })).max(1000), reviews: reviewSummarySchema });
function unwrap(value: unknown): unknown {
  const error = errorSchema.safeParse(value);
  if (error.success) throw new AgentError(error.data.error, error.data.retryAfter);
  return value;
}
export function createAgentService(read: ReadRepository, now = () => Date.now(), workspaceSlug?: string) {
  const query = async (action: string, args: Record<string, unknown>) => unwrap(await read(action, args));
  return async (name: ToolName, input: unknown): Promise<Record<string, unknown>> => {
    const parsed = toolInputs[name].safeParse(input);
    if (!parsed.success) throw new AgentError("INVALID_INPUT");
    const args = parsed.data;
    const scope = "account" in args ? { account: args.account, site: args.site } : null;
    const base = scope ? sitePath(workspaceSlug ?? scope.account,scope.site) : "";
    const href = (kind: "scans" | "managed-values" | "operations" | "static-changes", number: number) => resourcePath(kind, number, workspaceSlug ?? scope!.account, scope!.site);
    const freshness = (scan: z.infer<typeof savedScanSchema>, number: number) => ({
      scan: number, href: href("scans", number), startedAt: scan.created_at,
      ageSeconds: Math.max(0, Math.floor((now() - Date.parse(scan.created_at)) / 1000)),
      source: "saved-data", liveFreshness: "unknown", status: scan.status,
      partialCoverage: true, limited: scan.status === "limited", truncated: scan.truncated, skippedFields: scan.skipped_fields,
      scope: scan.plan.map(p => ({ collection: p.name, types: p.types ?? ["money", "phone", "date", "number", "text"], specificText: p.searchText ?? null })),
      coverage: "Detected saved occurrences only; not a complete or current Webflow site index.",
    });
    let output: Record<string, unknown>;
    if (name === "list_sites") {
      const data = z.object({ rows: z.array(z.object({ account: z.string(), site: z.string(), name: z.string() })).max(6) }).parse(await query(name, args));
      output = { sites: data.rows.slice(0, 5).map(s => ({ ...s, href: sitePath(workspaceSlug ?? s.account,s.site) + "/overview" })), nextAfter: data.rows.length > 5 ? data.rows[4]!.site : null };
    } else if (name === "get_site_summary") {
      const data = z.object({ name: z.string(), activeValues: z.number(), scanCount: z.number(), latestScanAt: z.string().nullable(), uncertainSources: z.number(), recentNeedsAttention: z.boolean(), recentScans: z.array(z.object({ number: z.number().int().positive(), status: z.string(), recordedOccurrences: z.number(), startedAt: z.string() })).max(5) }).parse(await query(name, args));
      output = { ...data, recentScans: data.recentScans.map(s => ({ ...s, href: href("scans", s.number) })), href: base + "/overview", source: "saved-data", liveFreshness: "unknown" };
    } else if (name === "search_saved_content" && "query" in args && typeof args.query === "string") {
      const term = args.query;
      const candidates = z.array(savedScanSchema).max(20).parse(await query("search_candidates", scope!));
      const scan = candidates.find(s => compatibleSavedScan(s, term));
      const targetedScan = base + "/scans/new?" + new URLSearchParams({ q: args.query, types: savedTypeHint(args.query) }).toString();
      if (!scan) output = { source: "saved-data", scan: null, partialCoverage: true, liveFreshness: "unknown", matches: [], message: "no matching saved occurrence", targetedScan, actionRequired: "Choose scope and explicitly confirm a targeted scan in the dashboard." };
      else {
        const data = scanData.parse(await query("get_scan_results", { ...scope, scanId: scan.id }));
        const matches = savedMatches(data.scan, data.rows, args.query);
        output = { ...freshness(data.scan, data.number), matches: matches.slice(0, 5).map(m => ({ value: clip(m.label), displayTruncated: m.label.length > 300, occurrences: m.count, href: href("scans", data.number) + "?filter=all" })), moreGroups: matches.length > 5, message: matches.length ? "Matching saved groups; open dashboard before editing." : "no matching saved occurrence", targetedScan };
      }
    } else if (name === "get_scan_results") {
      const data = scanData.parse(await query(name, args));
      const groups = groupScanResults(data.scan, data.rows, data.rows).flatMap(s => s.duplicates);
      const page = "page" in args && typeof args.page === "number" ? args.page : 1;
      const ids = new Map(data.rows.map((r, i) => [r.id, i + 1]));
      const rows = groups.flatMap(g => g.occurrences.map(r => ({ ...r, groupSize: g.occurrences.length })));
      output = { ...freshness(data.scan, data.number), reviews: scanReviewSummary(data.scan, data.reviews), observation: "original-scan", readOnly: true,
        occurrences: rows.slice((page - 1) * 20, page * 20).map(r => ({ reference: `scan-${data.number}:occurrence-${ids.get(r.id)}`, value: clip(valueLabel(r.canonical)), displayTruncated: valueLabel(r.canonical).length > 300, type: r.canonical.type, collection: r.collection_name, item: r.item_name, field: r.field_name, range: { start: r.start_pos, end: r.end_pos, unit: "unicode-code-points" }, groupSize: r.groupSize, managedField: data.rows.find(o => o.id === r.id)!.managed_field })),
        nextPage: page * 20 < rows.length ? page + 1 : null,
        protection: "Managed field indicates a binding exists; exact protected ranges and current outcomes must be checked in the dashboard. No returned row authorizes editing.",
      };
    } else if (name === "list_managed_values" || name === "get_managed_value") {
      const data = z.array(valueRow).max(6).parse(await query(name, args));
      const values = data.slice(0, 5).map(v => ({ number: v.number, name: v.name, type: v.canonical.type, value: clip(valueLabel(v.canonical), 1000), displayTruncated: valueLabel(v.canonical).length > 1000, version: v.version, archived: !!v.archived_at, sources: v.sources, uncertain: v.uncertain, href: href("managed-values", v.number) }));
      output = name === "get_managed_value" ? { value: values[0], source: "saved-data", liveFreshness: "unknown" } : { values, nextBefore: data.length > 5 ? data[4]!.number : null };
    } else {
      const rows = z.array(z.object({ number: z.number().int().positive(), source: z.enum(["cms", "static"]), title: z.string(), target: z.string(), status: z.string(), verified: z.number(), total: z.number(), created_at: z.string(), attention: z.boolean() })).max(6).parse(await query("list_recent_changes", args));
      output = { changes: rows.slice(0, 5).map(r => ({ ...r, href: href(r.source === "cms" ? "operations" : "static-changes", r.number) })), nextCursor: rows.length > 5 ? { at: rows[4]!.created_at, number: rows[4]!.number, source: rows[4]!.source } : null, source: "saved-data" };
    }
    return checkedPayload({ ...output, costClass: "A", externalRequests: { W: 0, I: 0, E: 0, G: 0 } });
  };
}
