export function workspaceRoute(path: string) {
  const old = /^\/dashboard\/workspaces\/([0-9a-f-]{36})\/(sites|settings\/webflow)$/.exec(path);
  if (old) return { id: old[1]!, account: null, slug: null, suffix: old[2]! };
  const scoped = /^\/dashboard\/([a-z0-9-]{1,110})\/workspaces\/([a-z0-9-]{1,110})\/(sites|settings\/webflow)$/.exec(path);
  if (scoped) return { id: null, account: scoped[1]!, slug: scoped[2]!, suffix: scoped[3]! };
  const flat = /^\/dashboard\/([a-z0-9-]{1,110})\/(sites|settings\/webflow)$/.exec(path);
  return flat ? { id: null, account: null, slug: flat[1]!, suffix: flat[2]! } : null;
}
export function workspacePath(_account: string, route: { slug: string; is_primary: boolean }) {
  return `/dashboard/${route.slug}/sites`;
}
export function workspaceDestination(pathname:string, method:string, entry:{workspace_id:string;slug:string;is_primary:boolean}, suffix:string) {
 const canonical=workspacePath("",entry).replace(/sites$/,suffix);
 if ((method==="GET"||method==="HEAD")&&pathname!==canonical) return {kind:"redirect" as const,pathname:canonical};
 return {kind:"rewrite" as const,pathname:`/dashboard/workspaces/${entry.workspace_id}/${suffix}`};
}
