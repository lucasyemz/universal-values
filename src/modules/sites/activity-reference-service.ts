import "server-only";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { cmsActivityReference, cmsReferenceSchema, type ActivityReference } from "./activity-reference";

/** Bounded projections for visible cards only; no snapshots, events or provider reads. */
export async function activityReferences(siteId:string, rows:{id:string;source:"cms"|"static"}[]) {
 const {client}=await requireUser();
 const cms=rows.filter(r=>r.source==="cms").map(r=>r.id), statics=rows.filter(r=>r.source==="static").map(r=>r.id);
 const [cmsRows,staticRows]=await Promise.all([
  cms.length ? client.from("cms_change_requests").select("id,managed_before,managed_after,replacement:changes->0->after,scan:cms_scans!scan_id(search:plan->0->>searchText)").eq("site_id",siteId).in("id",cms) : {data:[],error:null},
  statics.length ? client.from("designer_changes").select("id,before:plan->changes->0->>before,after:plan->changes->0->>after").eq("site_id",siteId).in("id",statics) : {data:[],error:null},
 ]);
 const refs:Record<string,ActivityReference|undefined>={};
 if(!cmsRows.error)for(const row of z.array(cmsReferenceSchema).parse(cmsRows.data))refs["cms:"+row.id]=cmsActivityReference(row);
 if(!staticRows.error)for(const row of z.array(z.object({id:z.uuid(),before:z.string().nullable(),after:z.string().nullable()})).parse(staticRows.data)) {
  if(row.before!==null || row.after!==null)refs["static:"+row.id]={label:"Exemplo de alteração",before:row.before??undefined,after:row.after??undefined};
 }
 return refs;
}
