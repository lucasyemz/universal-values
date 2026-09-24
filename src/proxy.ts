import { resolveSiteEntry } from "@/modules/routes/site-resolve";
import { resolveWorkspaceEntry } from "@/modules/routes/workspace-resolve";
import { resolveResourceRoute } from "@/modules/routes/resolve";
import { workspaceRoute, workspaceDestination } from "@/modules/sites/workspace-url";
import { siteRoute, siteRouteDestination } from "@/modules/sites/url";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/connectors/supabase/config";
import type { Database } from "@/connectors/supabase/types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const config = getSupabaseConfig();
  if (!config) return response;
  const client = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", "private, no-store");
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Verify and refresh the session before Server Components consume cookies.
  const { data: identity } = await client.auth.getClaims();
  const resource = await resolveResourceRoute(client, request.nextUrl.pathname, request.nextUrl.searchParams, request.method, identity?.claims?.sub);
  if (resource) {
    const url = request.nextUrl.clone();
    if (resource.kind === "not-found") {
      const missing = new NextResponse("Not found", {status:404,headers:{"Cache-Control":"private, no-store"}});
      response.cookies.getAll().forEach(cookie=>missing.cookies.set(cookie));
      return missing;
    }
    url.pathname = resource.pathname;
    url.search = resource.search;
    const routed = resource.kind === "redirect" ? NextResponse.redirect(url,307) : NextResponse.rewrite(url,{request:{headers:request.headers}});
    response.cookies.getAll().forEach(cookie=>routed.cookies.set(cookie));
    routed.headers.set("Cache-Control","private, no-store");
    return routed;
  }
  const workspace = workspaceRoute(request.nextUrl.pathname);
  if (workspace) {
    const actor=identity?.claims?.sub;
    if (!actor) return response;
    const entry=await resolveWorkspaceEntry(client,actor,workspace);
    if (!entry) {
      const missing=new NextResponse("Not found",{status:404,headers:{"Cache-Control":"private, no-store"}});
      response.cookies.getAll().forEach(cookie=>missing.cookies.set(cookie));
      return missing;
    }
    const destination=workspaceDestination(request.nextUrl.pathname,request.method,entry,workspace.suffix);
    const url=request.nextUrl.clone();
    url.pathname=destination.pathname;
    const routed=destination.kind==="redirect"?NextResponse.redirect(url,307):NextResponse.rewrite(url,{request:{headers:request.headers}});
    response.cookies.getAll().forEach(cookie => routed.cookies.set(cookie));
    routed.headers.set("Cache-Control", "private, no-store");
    return routed;
  }
  const route = siteRoute(request.nextUrl.pathname);
  if (route) {
    const actor = identity?.claims?.sub;
    if (!actor) return response;
    const site = await resolveSiteEntry(client, actor, route);
    if (!site) {
      const missing = new NextResponse("Not found", {status:404,headers:{"Cache-Control":"private, no-store"}});
      response.cookies.getAll().forEach(cookie=>missing.cookies.set(cookie));
      return missing;
    }
    const destination = siteRouteDestination(request.nextUrl.pathname, site, request.method);
    if (destination) {
      const url = request.nextUrl.clone();
      url.pathname = destination.pathname;
      const routed = destination.kind === "redirect" ? NextResponse.redirect(url, 307) : NextResponse.rewrite(url, { request: { headers: request.headers } });
      response.cookies.getAll().forEach(cookie => routed.cookies.set(cookie));
      routed.headers.set("Cache-Control", "private, no-store");
      return routed;
    }
  }

  return response;
}

export const config = { matcher: ["/login", "/dashboard/:path*", "/api/connectors/webflow/:path*"] };
