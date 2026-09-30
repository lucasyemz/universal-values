import { readWebflowLoginUser } from "./login-userinfo";

/** Server-to-server OAuth UserInfo: the bearer is a Webflow token, not a Supabase JWT. */
export async function webflowUserInfoHandler(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  if (request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
  }
  const result = await readWebflowLoginUser(request.headers.get("authorization"));
  return result.ok
    ? Response.json(result.user, { headers })
    : Response.json({ error: "identity_unavailable" }, { status: result.status, headers });
}
