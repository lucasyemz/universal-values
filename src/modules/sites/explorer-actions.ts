"use server";
import { ExplorerCooldowns,retrySeconds } from "./explorer-cooldown";
import { readMetadata } from "./metadata-service";
import { explorerScopeSchema, explorerScopeKey, metadataExplorerScope } from "./explorer-scope";
import { z } from "zod";
import { loadSiteContent, loadWorkspaceSites, settingsAvailableSites } from "./service";
import { WebflowError } from "@/connectors/webflow/client";
import { webflowIdSchema } from "@/connectors/webflow/schemas";
const cooldowns=new ExplorerCooldowns();
export async function loadLiveCms(input:unknown) {
 const parsed=z.object({siteId:z.uuid(),collectionId:webflowIdSchema,scope:explorerScopeSchema,offset:z.number().int().min(0).max(1000000).default(0)}).safeParse(input);
 if(!parsed.success)return {ok:false as const,retryAfter:0,code:"scope_changed" as const};
 try {
 const before=await readMetadata(parsed.data.siteId,'collections');
 if(before.denied || explorerScopeKey(parsed.data.scope)!==explorerScopeKey(metadataExplorerScope(before)))return {ok:false as const,retryAfter:0,code:"scope_changed" as const};
 const remaining=cooldowns.remaining(parsed.data.scope);
 if(remaining)return {ok:false as const,retryAfter:remaining,code:"rate_limit" as const};
 const view=await loadSiteContent(parsed.data.siteId,parsed.data.collectionId,parsed.data.offset);const after=await readMetadata(parsed.data.siteId,'collections');
 if(after.denied || explorerScopeKey(metadataExplorerScope(before))!==explorerScopeKey(metadataExplorerScope(after)))return {ok:false as const,retryAfter:0,code:"scope_changed" as const};
 return {ok:true as const,view,fetchedAt:new Date().toISOString()};}
 catch(error){
  if(error instanceof WebflowError&&error.kind==='rate_limit'){
   const seconds=retrySeconds(error.retryAfter);cooldowns.block(parsed.data.scope,seconds);
   return {ok:false as const,retryAfter:seconds,code:'rate_limit' as const};
  }
  return {ok:false as const,retryAfter:0,code:'unavailable' as const};
 }
}
export async function discoverWorkspaceSites(workspaceId:unknown) {
 const id=z.uuid().parse(workspaceId);
 const view=await loadWorkspaceSites(id);
 return settingsAvailableSites(view.connections,true);
}

export async function explorerStructure(input:unknown) {
 const parsed=z.object({scope:explorerScopeSchema,collectionId:webflowIdSchema}).safeParse(input);
 if(!parsed.success)return {ok:false as const};
 try {
  const saved=await readMetadata(parsed.data.scope.siteId,'schema',parsed.data.collectionId);
  if(saved.denied || explorerScopeKey(parsed.data.scope)!==explorerScopeKey(metadataExplorerScope(saved)))return {ok:false as const};
  return {ok:true as const,details:saved.data?.details??null,fetchedAt:saved.entry?.fetchedAt??null};
 }catch{return {ok:false as const};}
}
