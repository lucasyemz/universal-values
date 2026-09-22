import { resolveResourceRoute } from "@/modules/routes/resolve";
import { workspaceRoute, workspacePath } from "@/modules/sites/workspace-url";
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
  await client.auth.getClaims();
  const resource = await resolveResourceRoute(client, request.nextUrl.pathname, request.nextUrl.searchParams, request.method);
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
    const account = workspace.account ? (await client.from("account_routes").select("user_id,slug").eq("slug", workspace.account).maybeSingle()).data : null;
    if (workspace.account && !account) return response;
    let lookup = client.from("workspace_routes").select("workspace_id,account_id,slug,is_primary");
    if (workspace.id) lookup = lookup.eq("workspace_id", workspace.id);
    else {
      lookup = lookup.eq("account_id", account!.user_id);
      lookup = workspace.slug ? lookup.eq("slug", workspace.slug) : lookup.eq("is_primary", true);
    }
    const entry = (await lookup.maybeSingle()).data;
    if (!entry) return response;
    const owner = account ?? (await client.from("account_routes").select("user_id,slug").eq("user_id", entry.account_id).maybeSingle()).data;
    if (!owner) return response;
    const redirect = !!workspace.id && ["GET", "HEAD"].includes(request.method);
    if (workspace.id && !redirect) return response;
    const url = request.nextUrl.clone();
    const suffix = workspace.suffix ?? "sites";
    url.pathname = redirect ? workspacePath(owner.slug, entry).replace(/sites$/, suffix) : `/dashboard/workspaces/${entry.workspace_id}/${suffix}`;
    const routed = redirect ? NextResponse.redirect(url, 307) : NextResponse.rewrite(url, { request: { headers: request.headers } });
    response.cookies.getAll().forEach(cookie => routed.cookies.set(cookie));
    routed.headers.set("Cache-Control", "private, no-store");
    return routed;
  }
  const route = siteRoute(request.nextUrl.pathname);
  if (route) {
    // Resolve namespaces with the signed-in client; RLS remains authoritative.
    const account = route.account ? await client.from("account_routes").select("user_id,slug").eq("slug", route.account).maybeSingle() : null;
    if (route.account && !account?.data) return response;
    let query = client.from("sites").select("id,slug,account_id");
    if (account?.data) query = query.eq("account_id", account.data.user_id).eq("slug", route.value);
    else query = query.eq(route.isId ? "id" : "legacy_slug", route.value);
    const { data, error } = await query.maybeSingle();
    if (!error && data?.slug) {
      const namespace = account?.data ?? (await client.from("account_routes").select("slug").eq("user_id", data.account_id).maybeSingle()).data;
      if (!namespace) return response;
      const destination = siteRouteDestination(request.nextUrl.pathname, { ...data, accountSlug: namespace.slug }, request.method);
      if (destination) {
        const url = request.nextUrl.clone();
        url.pathname = destination.pathname;
        const routed = destination.kind === "redirect" ? NextResponse.redirect(url, 307) : NextResponse.rewrite(url, { request: { headers: request.headers } });
        response.cookies.getAll().forEach(cookie => routed.cookies.set(cookie));
        routed.headers.set("Cache-Control", "private, no-store");
        return routed;
      }
    }
  }
  return response;
}

export const config = { matcher: ["/login", "/dashboard/:path*", "/api/connectors/webflow/:path*"] };
