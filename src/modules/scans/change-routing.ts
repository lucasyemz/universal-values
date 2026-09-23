import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { getScanSite } from "./service";
import { requireWorkspaceOwner } from "@/modules/sites/service";
const routingSchema = z.object({ id:z.uuid(), actor_id:z.uuid(), workspace_id:z.uuid(), site_id:z.uuid(), scan_id:z.uuid().nullable() });
/** Read-only routing identity. Never constructs a field plan or loads a snapshot. */
export async function loadChangeRouting(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const {client,user}=await requireUser();
  const row=await client.from("cms_change_requests").select("id,actor_id,workspace_id,site_id,scan_id").eq("id",id).maybeSingle();
  if(row.error)throw new Error("Operação indisponível.");
  if(!row.data || row.data.actor_id!==user.id)notFound();
  const request=routingSchema.parse(row.data);
  if(request.scan_id) {
    const scan=await client.from("cms_scans").select("id,actor_id,workspace_id,site_id").eq("id",request.scan_id).maybeSingle();
    if(scan.error)throw new Error("Scan indisponível.");
    if(!scan.data || scan.data.actor_id!==user.id || scan.data.site_id!==request.site_id || scan.data.workspace_id!==request.workspace_id)notFound();
    await requireWorkspaceOwner(request.workspace_id);
  } else {
    const site=await getScanSite(request.site_id);
    if(site.workspace_id!==request.workspace_id)notFound();
  }
  return request;
}
