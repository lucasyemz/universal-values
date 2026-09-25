import "server-only";
import { cache } from "react";
import { listWorkspaces } from "@/modules/workspaces/service";
import { requireUser } from "@/modules/auth/service";
import { workspacePath } from "@/modules/sites/workspace-url";
export const getWorkspaceNavigation = cache(async () => {
 const {client,user}=await requireUser();
 const [workspaces,routes]=await Promise.all([listWorkspaces(),client.from("workspace_routes").select("workspace_id,slug,is_primary").eq("account_id",user.id)]);
 if(routes.error)throw new Error("Workspace routes unavailable");
 return workspaces.flatMap(workspace=>{
  const route=routes.data?.find(r=>r.workspace_id===workspace.id);
  return route?[{...workspace,slug:route.slug,href:workspacePath("",route)}]:[];
 });
});
