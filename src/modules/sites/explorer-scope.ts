import { z } from "zod";
export const explorerScopeSchema=z.object({actorId:z.uuid(),workspaceId:z.uuid(),siteId:z.uuid(),connectionId:z.uuid(),generation:z.uuid()});
export type ExplorerScope=z.infer<typeof explorerScopeSchema>;
export function explorerScopeKey(scope:ExplorerScope) {
 return JSON.stringify([scope.actorId,scope.workspaceId,scope.siteId,scope.connectionId,scope.generation]);
}
export function metadataExplorerScope(saved:{actorId:string;generation:string;site:{id:string;workspace_id:string;connection_id:string}}):ExplorerScope {
 return {actorId:saved.actorId,workspaceId:saved.site.workspace_id,siteId:saved.site.id,connectionId:saved.site.connection_id,generation:saved.generation};
}
