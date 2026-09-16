import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/connectors/supabase/server";
import { getWebflowConfig } from "@/connectors/webflow/config";
import { encryptToken, hashOAuthState, verifyOAuthState } from "@/connectors/webflow/crypto";
import { exchangeCode } from "@/connectors/webflow/client";
import { credentialContext } from "@/modules/sites/service";
import { connectionSchema } from "@/modules/sites/schema";
import { finishOAuth } from "@/modules/sites/oauth-flow";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = getWebflowConfig();
  if (!config) return NextResponse.json({ error: "Integração Webflow não configurada." }, { status: 503 });
  const state = request.nextUrl.searchParams.get("state");
  const candidate = z.uuid().safeParse(state?.split(".")[0]);
  if (!candidate.success) return NextResponse.json({ error: "Autorização inválida. Reinicie a conexão." }, { status: 400 });
  const cookieName = "uv_webflow_" + candidate.data;
  const id = verifyOAuthState(state, request.cookies.get(cookieName)?.value);
  if (!id) return NextResponse.json({ error: "Autorização expirada ou inválida. Reinicie a conexão." }, { status: 400 });

  const done = (path: string) => {
    const response = NextResponse.redirect(new URL(path, config.redirectUri), 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(cookieName, "", { path: "/", maxAge: 0 });
    return response;
  };
  const client = await createSupabaseServerClient(true);
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) return done("/login");
  const result = await client.from("webflow_connections").select("id,workspace_id,actor_id,status,expires_at").eq("id", id).maybeSingle();
  const parsed = connectionSchema.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.actor_id !== user.data.user.id) return done("/dashboard?error=authorization");
  const connection = parsed.data;
  const back = "/dashboard/workspaces/" + connection.workspace_id + "/sites";
  if (request.nextUrl.searchParams.has("error")) return done(back + "?error=denied");
  const code = z.string().min(1).max(4096).safeParse(request.nextUrl.searchParams.get("code"));
  if (!code.success) return done(back + "?error=authorization");

  try {
    await finishOAuth({
      claim: async () => {
        const claimed = await client.rpc("claim_webflow_callback", { p_id: id, p_state_hash: hashOAuthState(state!) });
        if (claimed.error) throw new Error("Callback unavailable");
        return z.enum(["claimed", "busy", "ready"]).parse(claimed.data);
      },
      exchange: () => exchangeCode(config, code.data),
      save: async (token) => {
        const ciphertext = encryptToken(token, credentialContext(connection), config.encryptionKey);
        const saved = await client.rpc("complete_webflow_oauth", { p_id: id, p_ciphertext: ciphertext });
        if (saved.error) throw new Error("Credential persistence failed");
      },
    });
  } catch {
    // No raw provider exceptions, OAuth query or credentials are logged.
    return done(back + "?error=authorization");
  }
  return done("/dashboard/connections/" + id);
}
