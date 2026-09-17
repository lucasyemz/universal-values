import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/connectors/supabase/config";
import type { Database, Json } from "@/connectors/supabase/types";
import { allowedDesignerOrigin, gatewaySchema, sessionCodeSchema } from "@/modules/static-text/protocol";

export const runtime = "nodejs";
const origins = () => process.env.DESIGNER_ALLOWED_ORIGINS ?? "http://localhost:1337,https://webflow-ext.com";
function headers(request: Request) {
  const origin = request.headers.get("origin");
  return { "Cache-Control": "no-store", Vary: "Origin", ...(allowedDesignerOrigin(origin, origins()) ? {
    "Access-Control-Allow-Origin": origin!, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type",
  } : {}) };
}
export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: allowedDesignerOrigin(request.headers.get("origin"), origins()) ? 204 : 403, headers: headers(request) });
}
export async function POST(request: Request) {
  const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: headers(request) });
  if (!allowedDesignerOrigin(request.headers.get("origin"), origins())) return respond({ error: "Origem da extensão não autorizada. Confira DESIGNER_ALLOWED_ORIGINS no servidor." }, 403);
  const token = sessionCodeSchema.safeParse(request.headers.get("authorization")?.replace(/^Bearer /, ""));
  if (!token.success) return respond({ error: "Conecte sua conta pelo dashboard." }, 401);
  try {
    // Bound memory even when Content-Length is absent or inaccurate.
    const reader = request.body?.getReader();
    if (!reader) return respond({ error: "Requisição vazia." }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2_200_000) { await reader.cancel(); return respond({ error: "Prévia muito grande." }, 413); }
      chunks.push(chunk.value);
    }
    const input = gatewaySchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const config = getSupabaseConfig();
    if (!config) return respond({ error: "Supabase não configurado." }, 503);
    const client = createClient<Database>(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { action, webflowSiteId, ...payload } = input;
    const result = await client.rpc("designer_gateway", { p_token_hash: createHash("sha256").update(token.data).digest("hex"), p_webflow_site_id: webflowSiteId, p_action: action, p_payload: payload as Json });
    if (result.error) {
      const code = result.error.code;
      return respond({ error: code === "PGRST202" ? "Aplique a migration 009 para conectar a extensão." : code === "42501" ? "Sessão expirada, revogada ou de outro site. Conecte novamente." : "Operação não autorizada ou prévia desatualizada. Atualize a conexão e gere outra prévia; escritas incertas não são reenviadas." }, code === "42501" ? 401 : 409);
    }
    return respond({ data: result.data });
  } catch { return respond({ error: "Não foi possível validar a requisição ou acessar o histórico central." }, 400); }
}
