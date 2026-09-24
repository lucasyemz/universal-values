import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/connectors/supabase/types";
import type { siteRoute } from "@/modules/sites/url";

type Client = SupabaseClient<Database>;
type Site = { id: string; slug: string; account_id: string; workspace_id: string };
export async function siteWorkspace(client: Client, site: Site, actor: string) {
  if (site.account_id !== actor) return null;
  const { data, error } = await client.from("workspace_routes").select("slug")
    .eq("account_id", actor).eq("workspace_id", site.workspace_id).maybeSingle();
  return error || !data ? null : { ...site, workspaceSlug: data.slug };
}

export async function resolveSiteEntry(client: Client, actor: string, route: NonNullable<ReturnType<typeof siteRoute>>) {
  let query = client.from("sites").select("id,slug,account_id,workspace_id").eq("account_id", actor);
  if (route.namespace) {
    // Canonical workspace namespace wins over the legacy account alias, even if
    // the requested site is absent. Never search another workspace as fallback.
    const workspace = await client.from("workspace_routes").select("workspace_id,slug")
      .eq("account_id", actor).eq("slug", route.namespace).maybeSingle();
    if (workspace.error) return null;
    if (workspace.data) {
      const site = await query.eq("workspace_id", workspace.data.workspace_id).eq("slug", route.value).maybeSingle();
      return site.error || !site.data ? null : { ...site.data, workspaceSlug: workspace.data.slug };
    }
    const account = await client.from("account_routes").select("slug").eq("user_id", actor).eq("slug", route.namespace).maybeSingle();
    if (account.error || !account.data) return null;
    query = query.eq("slug", route.value);
  } else {
    query = query.eq(route.isId ? "id" : "legacy_slug", route.value);
  }
  const site = await query.maybeSingle();
  return site.error || !site.data ? null : siteWorkspace(client, site.data, actor);
}
