"use server";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { resourceLinks } from "@/modules/routes/links";
import { getScanSite } from "./service";
import { notFound } from "next/navigation";

export async function scanVersions(input: unknown) {
 const {id,page}=z.object({id:z.uuid(),page:z.number().int().min(1).max(100000)}).parse(input);
 const {client,user}=await requireUser();
 const current=await client.from("cms_scans").select("site_id,series_id,actor_id").eq("id",id).maybeSingle();
 if(current.error)throw new Error("Versions unavailable");
 if(!current.data || current.data.actor_id!==user.id)notFound();
 const scan=z.object({site_id:z.uuid(),series_id:z.uuid()}).parse(current.data);
 await getScanSite(scan.site_id);
 const result=await client.from("cms_scans").select("id,scan_version,is_latest,created_at,status").eq("site_id",scan.site_id).eq("series_id",scan.series_id).order("scan_version",{ascending:false}).range((page-1)*20,page*20);
 if(result.error)throw new Error("Versions unavailable");
 const rows=z.array(z.object({id:z.uuid(),scan_version:z.number().int().positive(),is_latest:z.boolean(),created_at:z.string(),status:z.string()})).parse(result.data);
 const visible=rows.slice(0,20),links=await resourceLinks("scans",visible.map(row=>row.id));
 return {more:rows.length>20,rows:visible.map(row=>({...row,href:links[row.id]!}))};
}
