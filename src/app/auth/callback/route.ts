import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/connectors/supabase/server";
import { authOrigin } from "@/modules/auth/origin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  let success = false;
  if (code && code.length <= 2048) {
    try {
      const client = await createSupabaseServerClient(true);
      const { error } = await client.auth.exchangeCodeForSession(code);
      success = !error;
    } catch { /* No authorization code or provider error details in logs. */ }
  }
  const response = NextResponse.redirect(new URL(success ? "/dashboard" : "/login?error=callback", authOrigin()));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
