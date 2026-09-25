export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const numberPattern = /^[1-9][0-9]{0,14}$/;
export const resourceSuffix = {
  scans: "scans", operations: "operations", "managed-values": "variables",
  "managed-value-previews": "variables/preview", "static-changes": "changes", "fact-previews": "facts/preview",
  "site-previews": "setup/sites", "workspace-previews": "setup/workspaces",
} as const;
export type ResourceKind = keyof typeof resourceSuffix;
export function canonicalPresentationSuffix(suffix: string) {
  return suffix.replace(/^\/managed-values(?=\/|$)/, "/variables");
}
export function internalPresentationSuffix(suffix: string) {
  return suffix.replace(/^\/variables(?=\/|$)/, "/managed-values");
}
export function resourceSegment(suffix: string) {
  suffix = canonicalPresentationSuffix(suffix);
  for (const [kind, prefix] of Object.entries(resourceSuffix)) {
    const match = new RegExp(`^/${prefix}/([^/]+)/?$`).exec(suffix);
    if(match && (uuidPattern.test(match[1]!) || numberPattern.test(match[1]!))) return {kind:kind as ResourceKind,value:match[1]!};
  }
  return null;
}
export function legacyResource(path: string) {
  const patterns: [ResourceKind,RegExp][] = [
    ["scans",/^\/dashboard\/scans\/([^/]+)$/], ["operations",/^\/dashboard\/changes\/([^/]+)$/],
    ["managed-value-previews",/^\/dashboard\/managed-values\/preview\/([^/]+)$/],
    ["managed-values",/^\/dashboard\/managed-values\/([^/]+)$/],
    ["site-previews",/^\/dashboard\/sites\/preview\/([^/]+)$/],
    ["workspace-previews",/^\/dashboard\/workspaces\/preview\/([^/]+)$/],
  ];
  for(const [kind,pattern] of patterns){const match=pattern.exec(path);if(match && uuidPattern.test(match[1]!))return {kind,id:match[1]!};}
  return null;
}
export function sitePath(workspace: string, site: string) {
  return `/dashboard/${workspace}/sites/${site}`;
}
export function resourcePath(kind:ResourceKind,number:number,namespace:string,site?:string) {
  const base=site?sitePath(namespace,site):`/dashboard/${namespace}`;
  return `${base}/${resourceSuffix[kind]}/${number}`;
}
export function internalResourcePath(kind:ResourceKind,id:string,siteId?:string) {
  switch(kind){
    case "scans":return `/dashboard/scans/${id}`;
    case "operations":return `/dashboard/changes/${id}`;
    case "managed-values":return `/dashboard/managed-values/${id}`;
    case "managed-value-previews":return `/dashboard/managed-values/preview/${id}`;
    case "site-previews":return `/dashboard/sites/preview/${id}`;
    case "workspace-previews":return `/dashboard/workspaces/preview/${id}`;
    case "static-changes":return `/dashboard/sites/${siteId}/changes/${id}`;
    case "fact-previews":return `/dashboard/sites/${siteId}/facts/preview/${id}`;
  }
}

// The Designer receives a canonical site route from its authenticated session.
export function newScanFromSitePath(path?:string){
 const match=path?.match(/^(\/dashboard\/[a-z0-9-]+\/sites\/[a-z0-9-]+)\/overview$/);
 return match?`${match[1]}/scans/new`:null;
}
