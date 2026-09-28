import "server-only";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { getScanSite } from "@/modules/scans/service";

const labelSchema = z.object({source_key:z.string(),item_name:z.string(),collection_name:z.string(),field_name:z.string()});
export type SourceLabel = z.infer<typeof labelSchema>;
/** Saved display metadata only: never a source snapshot or write authority. */
export async function managedSourceLabels(siteId:string, sourceKeys:string[]) {
 await getScanSite(siteId);
 const {client}=await requireUser();
 const labels:Record<string,SourceLabel>={};
 const keys=[...new Set(sourceKeys)];
 for(let offset=0;offset<keys.length;offset+=50){
  const result=await client.from("scan_occurrences").select("source_key,item_name,collection_name,field_name,cms_scans!inner(created_at)")
   .eq("site_id",siteId).in("source_key",keys.slice(offset,offset+50)).order("cms_scans(created_at)",{ascending:false}).order("id").limit(1000);
  if(result.error)throw new Error("Não foi possível carregar os nomes das fontes. Tente novamente.");
  for(const row of z.array(labelSchema).parse(result.data))labels[row.source_key]??=row;
 }
 return labels;
}
