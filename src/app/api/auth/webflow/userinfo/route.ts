import { NextRequest, NextResponse } from "next/server";
import { webflowUserInfoHandler } from "@/connectors/webflow/login-userinfo-handler";
import { webflowLoginEnabled } from "@/modules/auth/providers";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  if (!webflowLoginEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  return webflowUserInfoHandler(request);
}
