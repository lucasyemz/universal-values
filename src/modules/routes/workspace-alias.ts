import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/connectors/supabase/types";

/** Only called after the current namespace misses; never resolves across accounts. */
export async function workspaceAlias(client: SupabaseClient<Database>, actor: string, slug: string) {
  const alias = await client.from("workspace_route_aliases").select("workspace_id")
    .eq("account_id", actor).eq("slug", slug).maybeSingle();
  if (alias.error) return { data: null, error: alias.error };
  if (!alias.data) return { data: null, error: null };
  return client.from("workspace_routes").select("workspace_id,account_id,slug,is_primary")
    .eq("account_id", actor).eq("workspace_id", alias.data.workspace_id).maybeSingle();
}
