export type ProviderAction = "metadata_refresh" | "scan_batch" | "cms_live" | "unclassified";
export type ProviderScope = {action:ProviderAction;siteId?:string;workspaceId?:string};
export type ProviderEvent = {provider:"webflow";action:ProviderAction;endpoint:"sites"|"collections"|"schema"|"items"|"item"|"site"|"other";operation:"read"|"write";status:number;rateLimited:boolean;durationMs:number;siteId?:string;workspaceId?:string};
export function providerEndpoint(path:string):ProviderEvent["endpoint"] {
 const clean=path.split('?')[0]!;
 if(clean==='/sites')return 'sites';
 if(/^\/sites\/[^/]+\/collections$/.test(clean))return 'collections';
 if(/^\/sites\/[^/]+$/.test(clean))return 'site';
 if(/^\/collections\/[^/]+\/items\/[^/]+$/.test(clean))return 'item';
 if(/^\/collections\/[^/]+\/items$/.test(clean))return 'items';
 if(/^\/collections\/[^/]+$/.test(clean))return 'schema';
 return 'other';
}
export async function providerRequest(fetcher:typeof fetch,path:string,init:RequestInit,scope?:ProviderScope,sink:(event:ProviderEvent)=>void=event=>console.info(JSON.stringify(event))) {
 const started=Date.now();let status=0;
 try{const response=await fetcher('https://api.webflow.com/v2'+path,init);status=response.status;return response;}
 finally{
  const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  const action:ProviderAction=scope && ['metadata_refresh','scan_batch','cms_live'].includes(scope.action)?scope.action:'unclassified';
  try{sink({provider:'webflow',action,endpoint:providerEndpoint(path),operation:init.method==='PATCH'?'write':'read',status,rateLimited:status===429,durationMs:Math.max(0,Date.now()-started),...(scope?.siteId&&uuid.test(scope.siteId)?{siteId:scope.siteId}:{}),...(scope?.workspaceId&&uuid.test(scope.workspaceId)?{workspaceId:scope.workspaceId}:{})});}catch{/* Logging must not change provider/write behavior. */}
 }
}
