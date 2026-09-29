import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

/** Recovery credentials live only for this action, never in browser session cookies. */
export function createRecoveryClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Authentication unavailable");
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
