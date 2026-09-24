import { sitePath } from "@/modules/routes/resources";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const segment = /^[a-zA-Z0-9-]{1,110}$/;

export function siteRoute(pathname: string) {
  const scoped = /^\/dashboard\/([^/]+)\/sites\/([^/]+)(\/.*)?$/.exec(pathname);
  if (scoped) {
    if (!segment.test(scoped[1]!) || !segment.test(scoped[2]!)) return null;
    return { namespace: scoped[1]!, value: scoped[2]!, isId: false, suffix: scoped[3] ?? "" };
  }
  const match = /^\/dashboard\/sites\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!match || match[1] === "preview" || !segment.test(match[1]!)) return null;
  return { namespace: null, value: match[1]!, isId: uuid.test(match[1]!), suffix: match[2] ?? "" };
}

export function siteRouteDestination(pathname: string, site: { id: string; slug: string; workspaceSlug: string }, method: string) {
  const route = siteRoute(pathname);
  if (!route) return null;
  const reading = method === "GET" || method === "HEAD";
  const siteEntry = !route.suffix || route.suffix === "/";
  const canonical = sitePath(site.workspaceSlug,site.slug) + (siteEntry ? "/scans" : route.suffix);
  if (reading && pathname !== canonical) {
    return { kind: "redirect" as const, pathname: canonical };
  }
  if (!route.namespace && route.isId) return null;
  return { kind: "rewrite" as const, pathname: `/dashboard/sites/${site.id}${route.suffix}` };
}
