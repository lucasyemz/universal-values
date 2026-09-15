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
  return response;
}

export const config = { matcher: ["/login", "/dashboard/:path*"] };
