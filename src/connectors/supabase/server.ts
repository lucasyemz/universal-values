import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import type { Database } from "./types";

export async function createSupabaseServerClient(writable = false) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase não configurado.");
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Rendering uses the proxy to refresh cookies; actions may write them.
        if (writable) values.forEach(({ name, value, options }) => store.set(name, value, options));
      },
    },
  });
}
