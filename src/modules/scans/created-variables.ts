import "server-only";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { resourceLinks } from "@/modules/routes/links";
import { getScanSite } from "./service";
import { buildManagedSyncPlan } from "@/modules/managed-values/sync-plan";
import { changeRequestSchema } from "./change-request-plan";
import { reviewedChanges } from "./review-history";
import type { Occurrence } from "./schema";
import type { Scan } from "./schema";

export const CREATED_VARIABLES_PAGE_SIZE = 20;
const valueSchema=z.object({id:z.uuid(),name:z.string(),created_at:z.string(),archived_at:z.string().nullable()});
const originSchema=z.object({managed_value_id:z.uuid(),scan_id:z.uuid()});

// The caller has loaded this scan through loadScanResults; retain actor/site
// predicates and authenticated RLS on this narrow creation-history projection.
export async function scanCreatedVariables(scan:Pick<Scan,"id"|"site_id"|"actor_id">,page:number,includeRows:boolean,linkedIds:string[]=[]) {
 const {client,user}=await requireUser();
 if(scan.actor_id!==user.id)throw new Error("Scan unavailable");
 const result=await client.from("managed_value_previews").select("managed_value_id")
  .eq("scan_id",scan.id).eq("site_id",scan.site_id).eq("actor_id",user.id).not("managed_value_id","is",null);
 if(result.error)throw new Error("Histórico de criação indisponível.");
 const createdIds=z.array(z.object({managed_value_id:z.uuid()})).parse(result.data??[]).map(row=>row.managed_value_id);
 const allIds=[...new Set([...createdIds,...linkedIds])].sort();
 const ids=includeRows?allIds.slice((page-1)*CREATED_VARIABLES_PAGE_SIZE,page*CREATED_VARIABLES_PAGE_SIZE):[];
 if(!ids.length)return {total:allIds.length,createdIds,values:[],links:{} as Record<string,string>};
 const values=await client.from("managed_values").select("id,name,created_at,archived_at").eq("site_id",scan.site_id).in("id",ids);
 if(values.error)throw new Error("Variáveis indisponíveis.");
 const rows=z.array(valueSchema).parse(values.data);
 return {total:allIds.length,createdIds,values:ids.flatMap(id=>rows.filter(row=>row.id===id)),links:await resourceLinks("managed-values",rows.map(row=>row.id))};
}

export async function variableScanOrigins(siteId:string,valueIds:string[]) {
 if(!valueIds.length)return {} as Record<string,{href:string;number:string}>;
 await getScanSite(siteId);
 const {client,user}=await requireUser();
 const result=await client.from("managed_value_previews").select("managed_value_id,scan_id")
  .eq("site_id",siteId).eq("actor_id",user.id).in("managed_value_id",valueIds);
 if(result.error)throw new Error("Origem da variável indisponível.");
 const rows=z.array(originSchema).parse(result.data??[]);
 const links=await resourceLinks("scans",[...new Set(rows.map(row=>row.scan_id))]);
 return Object.fromEntries(rows.flatMap(row=>links[row.scan_id] ? [[row.managed_value_id,{href:links[row.scan_id]+"?filter=variables",number:links[row.scan_id]!.split("/").at(-1)!}]] : []));
}

// Load persisted evidence only for visible variable cards, never provider content.
export async function variableEvidence(siteId:string,valueId:string,scanRows:Occurrence[]) {
 await getScanSite(siteId);
 const {client,user}=await requireUser();
 const result=await client.from("cms_change_requests")
  .select("id,created_at,managed_snapshot,managed_after,results,status")
  .eq("site_id",siteId).eq("actor_id",user.id).eq("managed_value_id",valueId)
  .in("status",["confirmed","completed"]).order("created_at",{ascending:false}).order("id").limit(1);
 if(result.error)throw new Error("Histórico da variável indisponível.");
 const schema=changeRequestSchema.pick({id:true,managed_snapshot:true,managed_after:true,results:true,status:true}).extend({created_at:z.string()});
 const request=z.array(schema).parse(result.data??[])[0];
 if(!request?.managed_snapshot || !request.managed_after)return null;
 const plan=buildManagedSyncPlan(request.managed_snapshot,request.managed_after,request.id);
 if(plan.plan.some(field=>field.binding.site_id!==siteId || field.binding.managed_value_id!==valueId))throw new Error("Histórico da variável inválido.");
 const rows=plan.occurrences.filter(row=>scanRows.some(source=>source.source_key===row.source_key)).map(row=>{
  const original=scanRows.find(source=>source.source_key===row.source_key);
  return original?{...row,item_name:original.item_name,collection_name:original.collection_name,field_name:original.field_name}:row;
 });
 const history=reviewedChanges(rows,[{...request,changes:plan.changes,reverts_request_id:null}]);
 return {rows,history,results:request.results};
}
