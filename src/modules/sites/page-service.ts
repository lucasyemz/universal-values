import { operationLinks, resourceLinks } from "@/modules/routes/links";
import { loadReviewState } from "@/modules/scans/review-state";
import { countReviewedOccurrences } from "@/modules/scans/reviewed-content";
import { occurrenceSchema, groupScanResults } from "@/modules/scans/schema";
import { changeDestination } from "@/modules/scans/change-destination";
import "server-only";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { getScanSite } from "@/modules/scans/service";
import { savedValueSchema, scanSchema } from "@/modules/scans/schema";
import { summarizeDesignerChange } from "@/modules/static-text/history";
import { cmsOperationSummary, PAGE_SIZE } from "./presentation";

export async function siteScansPage(id: string, page: number) {
  const site = await getScanSite(id); const { client } = await requireUser();
  const result = await client.from("cms_scans").select("*", { count: "exact" }).eq("site_id", id).order("created_at", { ascending: false }).order("id").range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1);
  if (result.error) throw new Error("Não foi possível carregar os scans. Atualize a página para tentar novamente.");
  const scans = z.array(scanSchema).parse(result.data);
  const reviewCounts = Object.fromEntries(await Promise.all(scans.map(async scan => {
    if (!["completed", "limited"].includes(scan.status)) return [scan.id, null] as const;
    const rows = await client.from("scan_occurrences").select("*").eq("scan_id", scan.id).order("id").limit(1000);
    if (rows.error) throw new Error("Não foi possível carregar as contagens de revisão.");
    const occurrences = z.array(occurrenceSchema).parse(rows.data);
    const state = await loadReviewState(client, scan, occurrences);
    return [scan.id, state.reviewsMissing ? null : countReviewedOccurrences(groupScanResults(scan, occurrences, occurrences), state.reviewedIds)] as const;
  })));
  return { site, scans, reviewCounts, scanLinks: await resourceLinks("scans",scans.map(scan=>scan.id)), total: result.count ?? 0 };
}
export async function siteValuesPage(id: string, page: number, query: string, filter: string) {
  const site = await getScanSite(id); const { client } = await requireUser();
  let lookup = client.from("managed_values").select("*", { count: "exact" }).eq("site_id", id);
  if (filter === "active") lookup = lookup.is("archived_at", null);
  if (filter === "archived") lookup = lookup.not("archived_at", "is", null);
  if (query) lookup = lookup.ilike("name", "%" + query.replace(/[\\%_]/g, "\\$&") + "%");
  const result = await lookup.order("created_at", { ascending: false }).order("id").range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1);
  if (result.error) throw new Error("Não foi possível carregar os valores. Atualize a página para tentar novamente.");
  const values = z.array(savedValueSchema).parse(result.data);
  const bindings = values.length ? await client.from("managed_value_bindings").select("managed_value_id,uncertain", { count: "exact" }).in("managed_value_id",values.map(value=>value.id)).limit(1000) : { data: [], count: 0, error: null };
  const sources = bindings.error || (bindings.count ?? 0)>1000 ? null : Object.fromEntries(values.map(value=>[value.id, { count: (bindings.data??[]).filter(binding=>binding.managed_value_id===value.id).length, uncertain: (bindings.data??[]).some(binding=>binding.managed_value_id===value.id && binding.uncertain) }]));
  return { site, values, sources, valueLinks: await resourceLinks("managed-values",values.map(value=>value.id)), total: result.count ?? 0 };
}
const operationSchema = z.object({ id: z.uuid(), status: z.string(), cursor: z.number(), total: z.number(), created_at: z.string(), expires_at: z.string(), results: z.unknown(), scan_id: z.string().nullish(), managed_value_id: z.string().nullable(), reverts_request_id: z.string().nullable() });
export type SiteActivity = { id: string; source: "cms" | "static"; title: string; target: string; status: string; label?: string; verified: number; total: number; createdAt: string; href: string; attention: boolean };
export async function siteChangesPage(id: string, page: number, filter: string) {
  const site = await getScanSite(id); const { client } = await requireUser();
  // Fetch the prefix of each stream, merge chronologically, then paginate.
  // Every row in the requested prefix is included even when one source dominates.
  const limit = page * PAGE_SIZE + 1;
  const [cms, designer] = await Promise.all([
    filter === "static" ? null : client.from("cms_change_requests").select("id,status,cursor,total,created_at,expires_at,results,scan_id,managed_value_id,reverts_request_id").eq("site_id", id).order("created_at", { ascending: false }).order("id").limit(filter === "attention" ? 1000 : limit),
    filter === "cms" ? null : client.from("designer_changes").select("id,plan,events,search_text,created_at,expires_at").eq("site_id", id).order("created_at", { ascending: false }).order("id").limit(filter === "attention" ? 1000 : limit),
  ]);
  if (cms?.error || designer?.error) throw new Error("Não foi possível carregar o histórico completo. Atualize a página ou selecione uma origem.");
  const rows: SiteActivity[] = z.array(operationSchema).parse(cms?.data ?? []).map(row => ({ id: row.id, source: "cms", title: row.reverts_request_id ? "Reversão" : row.managed_value_id ? "Sincronização de valor" : "Edição de conteúdo", target: "CMS", ...cmsOperationSummary(row), total: row.total, createdAt: row.created_at, href: changeDestination(row.id,row.scan_id) }));
  for (const row of designer?.data ?? []) {
    const summary = summarizeDesignerChange(row);
    const attention = summary.changes.some(c => ["conflict", "uncertain", "dispatching"].includes(c.status ?? ""));
    rows.push({ id: row.id, source: "static", title: "Edição de texto", target: summary.pageName || "Página estática", status: attention ? "uncertain" : summary.verified === summary.changes.length ? "applied" : "draft", label: summary.status, verified: summary.verified, total: summary.changes.length, createdAt: row.created_at, href: `/dashboard/sites/${id}/changes/${row.id}`, attention });
  }
  const sorted = rows.filter(row => filter !== "attention" || row.attention).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const visible = sorted.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const [cmsLinks,staticLinks]=await Promise.all([operationLinks(visible.filter(row=>row.source==="cms").map(row=>row.id)),resourceLinks("static-changes",visible.filter(row=>row.source==="static").map(row=>row.id))]);
  return { site, rows: visible.map(row=>({...row,href:(row.source==="cms"?cmsLinks:staticLinks)[row.id]!})), hasMore: sorted.length>page*PAGE_SIZE, limited: filter === "attention" };
}
export async function siteOverview(id: string) {
  const site = await getScanSite(id); const { client } = await requireUser();
  const [values, scans, running, uncertain, recent] = await Promise.all([
    client.from("managed_values").select("id", { count: "exact", head: true }).eq("site_id", id).is("archived_at", null),
    client.from("cms_scans").select("id,status,occurrences_count,created_at", { count: "exact" }).eq("site_id", id).order("created_at", { ascending: false }).limit(5),
    client.from("cms_scans").select("id,status").eq("site_id", id).in("status", ["running", "paused"]),
    client.from("managed_value_bindings").select("managed_value_id", { count: "exact" }).eq("site_id", id).eq("uncertain", true).limit(5),
    siteChangesPage(id, 1, "all"),
  ]);
  if (values.error || scans.error || running.error || uncertain.error) throw new Error("Não foi possível carregar o resumo. Atualize a página para tentar novamente.");
  const [scanLinks,valueLinks]=await Promise.all([resourceLinks("scans",[...new Set([...(scans.data??[]),...(running.data??[])].map(scan=>scan.id))]),resourceLinks("managed-values",[...new Set((uncertain.data??[]).map(binding=>binding.managed_value_id))])]);
  const activity = [
    ...(scans.data ?? []).map(scan => ({ id: scan.id, title: "Scan do CMS", description: `${scan.occurrences_count} ocorrências registradas`, createdAt: scan.created_at, status: scan.status, label: undefined as string | undefined, href: scanLinks[scan.id]! })),
    ...recent.rows.map(row => ({ id: row.id, title: row.title, description: `${row.target} · ${row.verified}/${row.total} verificados`, createdAt: row.createdAt, status: row.status, label: row.label, href: row.href })),
  ].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  const attention = !!running.data?.length || (uncertain.count ?? 0)>0 || recent.rows.some(row=>row.attention);
  return { attention, activity, site, scanLinks, valueLinks, activeValues: values.count ?? 0, scanCount: scans.count ?? 0, scans: scans.data ?? [], running: running.data ?? [], uncertainCount: uncertain.count ?? 0, uncertain: uncertain.data ?? [], recent: recent.rows };
}
