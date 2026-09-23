import { operationLinks, resourceLinks } from "@/modules/routes/links";
import { scanListSchema, reviewSummarySchema, scanReviewSummary } from "@/modules/scans/list-summary";

import "server-only";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { getScanSite } from "@/modules/scans/service";
import { savedValueSchema } from "@/modules/scans/schema";
import { activityRowSchema, decodeActivityCursor, encodeActivityCursor } from "./activity-page";
import { activityDestination, PAGE_SIZE } from "./presentation";

export async function siteScansPage(id: string, page: number) {
  const site = await getScanSite(id); const { client } = await requireUser();
  const result = await client.from("cms_scans").select("id,status,plan,created_at", { count: "exact" }).eq("site_id", id).order("created_at", { ascending: false }).order("id").range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1);
  if (result.error) throw new Error("Não foi possível carregar os scans. Atualize a página para tentar novamente.");
  const scans = z.array(scanListSchema).parse(result.data);
  const summaries = scans.length ? await client.rpc("scan_review_summaries", {p_ids:scans.map(scan=>scan.id)}) : {data:[],error:null};
  if(summaries.error)throw new Error("Não foi possível carregar as contagens de revisão. Confira a migration da Phase B.");
  const summaryRows=z.array(reviewSummarySchema).parse(summaries.data);
  const reviewCounts=Object.fromEntries(scans.map(scan=>{const row=summaryRows.find(r=>r.scan_id===scan.id);return [scan.id,row?scanReviewSummary(scan,row):null];}));
  return { site, scans, reviewCounts, scanLinks: await resourceLinks("scans",scans.map(scan=>scan.id)), total: result.count ?? 0 };
}
export async function siteValuesPage(id: string, page: number, query: string, filter: string) {
  const site = await getScanSite(id); const { client } = await requireUser();
  let lookup = client.from("managed_values").select("id,site_id,name,canonical,version,created_at,archived_at", { count: "exact" }).eq("site_id", id);
  if (filter === "active") lookup = lookup.is("archived_at", null);
  if (filter === "archived") lookup = lookup.not("archived_at", "is", null);
  if (query) lookup = lookup.ilike("name", "%" + query.replace(/[\\%_]/g, "\\$&") + "%");
  const result = await lookup.order("created_at", { ascending: false }).order("id").range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1);
  if (result.error) throw new Error("Não foi possível carregar os valores. Atualize a página para tentar novamente.");
  const values = z.array(savedValueSchema).parse(result.data);
  const bindings = values.length ? await client.rpc("managed_binding_summaries",{p_ids:values.map(value=>value.id)}) : {data:[],error:null};
  if(bindings.error) throw new Error("Não foi possível carregar as fontes.");
  const sources=Object.fromEntries(z.array(z.object({managed_value_id:z.uuid(),count:z.number().int().nonnegative(),uncertain:z.boolean()})).parse(bindings.data).map(row=>[row.managed_value_id,{count:row.count,uncertain:row.uncertain}]));
  return { site, values, sources, valueLinks: await resourceLinks("managed-values",values.map(value=>value.id)), total: result.count ?? 0 };
}
export type SiteActivity = { id: string; source: "cms" | "static"; title: string; target: string; status: string; label?: string; verified: number; total: number; createdAt: string; href: string; attention: boolean };
export async function siteChangesPage(id: string, page: number, filter: string, cursor?: string, previous = false) {
  const site = await getScanSite(id); const { client } = await requireUser();
  const decoded = decodeActivityCursor(cursor);
  const result = await client.rpc("site_activity_page", { p_site: id, p_filter: filter, p_offset: (page-1)*PAGE_SIZE, p_cursor: decoded ?? null, p_previous: !!decoded && previous });
  if (result.error) throw new Error("Não foi possível carregar o histórico completo. Atualize a página ou selecione uma origem.");
  const rows = z.array(activityRowSchema).parse(result.data);
  const visible = rows.slice(0,PAGE_SIZE);
  if (decoded && previous) visible.reverse();
  const [cmsLinks,staticLinks]=await Promise.all([operationLinks(visible.filter(row=>row.source==="cms").map(row=>row.id)),resourceLinks("static-changes",visible.filter(row=>row.source==="static").map(row=>row.id))]);
  return { site, rows: visible.map(row=>({...row, createdAt: row.created_at, label: row.label ?? undefined, href:activityDestination((row.source==="cms"?cmsLinks:staticLinks)[row.id]!, row.attention, row.status)})), hasMore: decoded && previous ? true : rows.length>PAGE_SIZE, limited: filter === "attention",
    nextCursor: visible.length ? encodeActivityCursor(visible[visible.length-1]!) : undefined,
    previousCursor: visible.length ? encodeActivityCursor(visible[0]!) : undefined };
}
export async function siteOverview(id: string) {
  const site = await getScanSite(id); const { client } = await requireUser();
  const response = await client.rpc("site_overview_summary", { p_site: id });
  if(response.error) throw new Error("Não foi possível carregar o resumo. Atualize a página para tentar novamente.");
  const data = z.object({activeValues:z.number(),scanCount:z.number(),latestScanAt:z.string().nullable(), scans:z.array(z.object({id:z.uuid(),status:z.string(),occurrences_count:z.number(),created_at:z.string()})), running:z.array(z.object({id:z.uuid(),status:z.string()})),uncertainCount:z.number(),uncertain:z.array(z.object({managed_value_id:z.uuid()})), recent:z.array(activityRowSchema),activity:z.array(z.object({id:z.uuid(),source:z.enum(["cms","static","scan"])}))}).parse(response.data);
  const [cmsLinks,staticLinks]=await Promise.all([operationLinks(data.recent.filter(row=>row.source==="cms").map(row=>row.id)),resourceLinks("static-changes",data.recent.filter(row=>row.source==="static").map(row=>row.id))]);
  const recent={rows:data.recent.map(row=>({...row,createdAt:row.created_at,label:row.label??undefined,href:activityDestination((row.source==="cms"?cmsLinks:staticLinks)[row.id]!,row.attention,row.status)}))};
  const scans={data:data.scans,count:data.scanCount},running={data:data.running},uncertain={data:data.uncertain,count:data.uncertainCount};
  const [scanLinks,valueLinks]=await Promise.all([resourceLinks("scans",[...new Set([...(scans.data??[]),...(running.data??[])].map(scan=>scan.id))]),resourceLinks("managed-values",[...new Set((uncertain.data??[]).map(binding=>binding.managed_value_id))])]);
  const activity = [
    ...(scans.data ?? []).map(scan => ({ id: scan.id, title: "Scan do CMS", description: `${scan.occurrences_count} ocorrências registradas`, createdAt: scan.created_at, status: scan.status, label: undefined as string | undefined, href: scanLinks[scan.id]! })),
    ...recent.rows.map(row => ({ id: row.id, title: row.title, description: `${row.target} · ${row.verified}/${row.total} verificados`, createdAt: row.createdAt, status: row.status, label: row.label, href: row.href })),
  ].sort((a,b)=>data.activity.findIndex(row=>row.id===a.id)-data.activity.findIndex(row=>row.id===b.id)).filter(row=>data.activity.some(item=>item.id===row.id));
  const attention = !!running.data?.length || (uncertain.count ?? 0)>0 || recent.rows.some(row=>row.attention);
  return { attention, activity, site, scanLinks, valueLinks, activeValues: data.activeValues, scanCount: scans.count ?? 0, scans: scans.data ?? [], running: running.data ?? [], uncertainCount: uncertain.count ?? 0, uncertain: uncertain.data ?? [], recent: recent.rows };
}
