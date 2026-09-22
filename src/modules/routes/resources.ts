export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const numberPattern = /^[1-9][0-9]{0,14}$/;
export const resourceSuffix = {
  scans: "scans", operations: "operations", "managed-values": "managed-values",
  "managed-value-previews": "managed-values/preview", "static-changes": "changes", "fact-previews": "facts/preview",
  "site-previews": "setup/sites", "workspace-previews": "setup/workspaces",
} as const;
export type ResourceKind = keyof typeof resourceSuffix;
export function resourceSegment(suffix: string) {
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
export function resourcePath(kind:ResourceKind,number:number,account:string,site?:string) {
  const base=site?`/dashboard/${account}/sites/${site}`:`/dashboard/${account}`;
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
