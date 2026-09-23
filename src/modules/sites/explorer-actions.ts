"use server";
import { z } from "zod";
import { loadSiteContent, loadWorkspaceSites, settingsAvailableSites } from "./service";
import { WebflowError } from "@/connectors/webflow/client";
import { webflowIdSchema } from "@/connectors/webflow/schemas";
export async function loadLiveCms(input:unknown) {
 const parsed=z.object({siteId:z.uuid(),collectionId:webflowIdSchema,offset:z.number().int().min(0).max(1000000).default(0)}).safeParse(input);
 if(!parsed.success)return {ok:false as const,retryAfter:0};
 try {const view=await loadSiteContent(parsed.data.siteId,parsed.data.collectionId,parsed.data.offset);return {ok:true as const,view,fetchedAt:new Date().toISOString()};}
 catch(error){return {ok:false as const,retryAfter:error instanceof WebflowError?error.retryAfter??0:0};}
}
export async function discoverWorkspaceSites(workspaceId:unknown) {
 const id=z.uuid().parse(workspaceId);
 const view=await loadWorkspaceSites(id);
 return settingsAvailableSites(view.connections,true);
}
