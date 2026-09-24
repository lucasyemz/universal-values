import "server-only";
import { cache } from "react";
import { requireUser } from "@/modules/auth/service";
import { resourcePath, sitePath, type ResourceKind } from "./resources";
import { workspacePath } from "@/modules/sites/workspace-url";

export const workspaceLink = cache(async (workspaceId: string) => {
 const { client, user } = await requireUser();
 const [account, workspace] = await Promise.all([
  client.from("account_routes").select("slug").eq("user_id", user.id).maybeSingle(),
  client.from("workspace_routes").select("slug,is_primary").eq("workspace_id", workspaceId).eq("account_id", user.id).maybeSingle(),
 ]);
 if (!account.data || !workspace.data) throw new Error("Endereço indisponível.");
 return workspacePath(account.data.slug, workspace.data);
});

const siteNamespace = cache(async (siteId:string|null,accountId:string) => {
 const {client}=await requireUser();
 if (siteId) {
  const site = await client.from("sites").select("slug,workspace_id").eq("id",siteId).eq("account_id",accountId).maybeSingle();
  if (site.error || !site.data) throw new Error("Endereço indisponível.");
  const workspace = await client.from("workspace_routes").select("slug").eq("workspace_id",site.data.workspace_id).eq("account_id",accountId).maybeSingle();
  if (workspace.error || !workspace.data) throw new Error("Endereço indisponível.");
  return { namespace:workspace.data.slug, site:site.data.slug };
 }
 const account = await client.from("account_routes").select("slug").eq("user_id",accountId).maybeSingle();
 if (account.error || !account.data) throw new Error("Endereço indisponível.");
 return { namespace:account.data.slug, site:undefined };

});
export async function resourceLinks(kind:ResourceKind,ids:string[]) {
 if(!ids.length)return {} as Record<string,string>;
 const {client}=await requireUser();
 const result=await client.from("dashboard_resource_routes").select("resource_id,number,site_id,account_id").eq("kind",kind).in("resource_id",ids);
 if(result.error)throw new Error("Aplique a migration de URLs do dashboard para carregar os endereços.");
 return Object.fromEntries(await Promise.all((result.data??[]).map(async row=>{
  const namespace=await siteNamespace(row.site_id,row.account_id);
  return [row.resource_id,resourcePath(kind,row.number,namespace.namespace,namespace.site)];
 })));
}
export const resourceLink=cache(async(kind:ResourceKind,id:string)=>{
 const links=await resourceLinks(kind,[id]);
 if(!links[id])throw new Error("Endereço indisponível.");
 return links[id];
});

export async function operationLinks(ids:string[]) {
 if(!ids.length)return {} as Record<string,string>;
 const {client}=await requireUser();
 const [paths,rows]=await Promise.all([
  resourceLinks("operations",ids),
  client.from("cms_change_requests").select("id,scan_id").in("id",ids),
 ]);
 if(rows.error)throw new Error("Endereço da operação indisponível.");
 const scanIds=[...new Set((rows.data??[]).flatMap(row=>row.scan_id?[row.scan_id]:[]))];
 const scans=await resourceLinks("scans",scanIds);
 return Object.fromEntries((rows.data??[]).map(row=>[row.id,row.scan_id && scans[row.scan_id] && paths[row.id] ? `${scans[row.scan_id]}?filter=reviewed&operation=${paths[row.id]!.split("/").at(-1)}` : paths[row.id]!]));
}

export async function siteLink(siteId: string) {
 const { user } = await requireUser();
 const namespace = await siteNamespace(siteId, user.id);
 if (!namespace.site) throw new Error("Endereço indisponível.");
 return sitePath(namespace.namespace,namespace.site);
}
