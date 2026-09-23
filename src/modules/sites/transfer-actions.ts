"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";
import { workspaceLink } from "@/modules/routes/links";
import { getConnectionReader, requireWorkspaceOwner } from "./service";

const previewSchema = z.object({ id: z.uuid(), site: z.uuid(), target: z.uuid() });
const storedSchema = z.object({ id: z.uuid(), site_id: z.uuid(), target_connection: z.uuid(), target_workspace: z.uuid(), site_name: z.string(), source_name: z.string(), target_name: z.string(), confirmed_at: z.string().nullable() });
export async function transferTargets(siteId: string) {
 if (!z.uuid().safeParse(siteId).success) return [];
 const {client,user}=await requireUser();
 const site=await client.from("sites").select("workspace_id").eq("id",siteId).single();
 if(!site.data)return [];
 await requireWorkspaceOwner(site.data.workspace_id);
 const members=await client.from("workspace_members").select("workspace_id").eq("user_id",user.id).eq("role","owner").neq("workspace_id",site.data.workspace_id);
 if(!members.data?.length)return [];
 const result=await client.from("workspaces").select("id,name").in("id",members.data.map(m=>m.workspace_id)).order("name");
 return result.data??[];
}
export async function prepareSiteTransfer(input: unknown) {
 const parsed=previewSchema.safeParse(input);
 if(!parsed.success)return {error:"Transfer unavailable"};
 const {id,site:siteId,target}=parsed.data;
 const {client,user}=await requireWorkspaceOwner(target);
 const site=await client.from("sites").select("workspace_id,webflow_site_id").eq("id",siteId).single();
 if(!site.data)return {error:"Transfer unavailable"};
 await requireWorkspaceOwner(site.data.workspace_id);
 const connections=await client.from("webflow_connections").select("id").eq("workspace_id",target).eq("actor_id",user.id).eq("status","ready").order("created_at",{ascending:false}).limit(20);
 for(const connection of connections.data??[]) {
  try {
   const {reader}=await getConnectionReader(connection.id,{action:"site_transfer",siteId,workspaceId:target});
   if(!(await reader.sites()).some(s=>s.id===site.data!.webflow_site_id))continue;
   const result=await client.rpc("preview_site_transfer",{p_id:id,p_site:siteId,p_target:target,p_connection:connection.id});
   if(result.error)return {error:"Transfer unavailable"};
   const preview=await client.from("site_transfers").select("id,site_id,target_connection,target_workspace,site_name,source_name,target_name,confirmed_at").eq("id",id).single();
   const value=storedSchema.safeParse(preview.data);
   return value.success?{preview:{id:value.data.id,name:value.data.site_name,from:value.data.source_name,to:value.data.target_name}}:{error:"Transfer unavailable"};
  } catch { return {error:"Could not verify Webflow access. Try again later."}; }
 }
 return {error:"Authorize this site in the destination workspace first.",settings:(await workspaceLink(target)).replace(/sites$/,"settings/webflow")};
}
export async function applySiteTransfer(input: unknown) {
 const parsed=z.object({id:z.uuid(),confirmed:z.literal(true)}).safeParse(input);
 if(!parsed.success)return {error:"Transfer unavailable"};
 const {client}=await requireUser();
 const row=await client.from("site_transfers").select("id,site_id,target_connection,target_workspace,site_name,source_name,target_name,confirmed_at").eq("id",parsed.data.id).single();
 const p=storedSchema.safeParse(row.data);
 if(!p.success)return {error:"Transfer unavailable"};
 if(!p.data.confirmed_at) {
  const site=await client.from("sites").select("webflow_site_id").eq("id",p.data.site_id).single();
  if(!site.data)return {error:"Transfer unavailable"};
  try {
   const {reader}=await getConnectionReader(p.data.target_connection,{action:"site_transfer",siteId:p.data.site_id,workspaceId:p.data.target_workspace});
   if(!(await reader.sites()).some(s=>s.id===site.data!.webflow_site_id))return {error:"Transfer unavailable"};
  } catch {return {error:"Could not verify Webflow access. Try again later."};}
 }
 const result=await client.rpc("confirm_site_transfer",{p_id:p.data.id});
 if(result.error)return {error:"Transfer could not be confirmed. Finish active work and check the destination connection."};
 revalidatePath("/dashboard","layout");
 return {href:await workspaceLink(p.data.target_workspace)};
}
