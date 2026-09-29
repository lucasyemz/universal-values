import { NextRequest, NextResponse } from "next/server";
import { readWebflowLoginUser } from "@/connectors/webflow/login-userinfo";
import { webflowLoginEnabled } from "@/modules/auth/providers";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  if (!webflowLoginEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  const result = await readWebflowLoginUser(request.headers.get("authorization"));
  return result.ok
    ? NextResponse.json(result.user, { headers })
    : NextResponse.json({ error: "identity_unavailable" }, { status: result.status, headers });
}
