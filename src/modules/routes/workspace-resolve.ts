import { workspaceAlias } from "./workspace-alias";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/connectors/supabase/types";
import { workspaceRoute } from "@/modules/sites/workspace-url";
export async function resolveWorkspaceEntry(client:SupabaseClient<Database>,actor:string,workspace:NonNullable<ReturnType<typeof workspaceRoute>>) {
    // Flat workspace names are relative to the verified account, never a global slug lookup.
    let lookup = client.from("workspace_routes").select("workspace_id,account_id,slug,is_primary").eq("account_id", actor);
    if (workspace.id) lookup = lookup.eq("workspace_id",workspace.id);
    else lookup = lookup.eq("slug",workspace.slug!);
    const result = await lookup.maybeSingle();
    if (result.error) return null;
    let entry = result.data;
    if (!entry && workspace.slug) {
      const alias = await workspaceAlias(client, actor, workspace.slug);
      if (alias.error) return null;
      entry = alias.data;
    }
    if (workspace.account || !entry && !workspace.id) {
      const owner=(await client.from("account_routes").select("slug").eq("user_id",actor).maybeSingle()).data;
      if (workspace.account) {
        if (owner?.slug!==workspace.account) entry=null;
      } else if (owner?.slug===workspace.slug) {
        // Compatibility alias for the former /dashboard/{account}/sites URL.
        entry=(await client.from("workspace_routes").select("workspace_id,account_id,slug,is_primary").eq("account_id",actor).eq("is_primary",true).maybeSingle()).data;
      }
    }
    return entry;
}
