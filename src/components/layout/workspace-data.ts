import "server-only";
import { z } from "zod";
import { sitePath } from "@/modules/routes/resources";
import { cache } from "react";
import { listWorkspaces } from "@/modules/workspaces/service";
import { requireUser } from "@/modules/auth/service";
import { workspacePath } from "@/modules/sites/workspace-url";
export const getWorkspaceNavigation = cache(async () => {
 const {client,user}=await requireUser();
 const [workspaces,routes,sites]=await Promise.all([listWorkspaces(),client.from("workspace_routes").select("workspace_id,slug,is_primary").eq("account_id",user.id),client.from("sites").select("id,workspace_id,display_name,slug").eq("account_id",user.id).order("display_name")]);
 if(routes.error)throw new Error("Workspace routes unavailable");
 const siteRows=sites.error ? null : z.array(z.object({id:z.string(),workspace_id:z.string(),display_name:z.string(),slug:z.string()})).parse(sites.data);
 return workspaces.flatMap(workspace=>{
  const route=routes.data?.find(r=>r.workspace_id===workspace.id);
  return route?[{...workspace,slug:route.slug,href:workspacePath("",route),sites:siteRows?.filter(site=>site.workspace_id===workspace.id).map(site=>({id:site.id,name:site.display_name,href:sitePath(route.slug,site.slug)+"/overview"})) ?? null}]:[];
 });
});
