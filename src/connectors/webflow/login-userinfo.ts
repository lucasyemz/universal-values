import { z } from "zod";

const userSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i),
  email: z.email().max(254),
  firstName: z.string().max(200).optional(),
  lastName: z.string().max(200).optional(),
});
export type LoginUserInfoResult =
  | { ok: true; user: { sub: string; email: string; email_verified: false; name: string } }
  | { ok: false; status: 401 | 502 | 503 };

/** Fixed upstream, no token storage, redirects, identity cache or privileged credentials. */
export async function readWebflowLoginUser(authorization: string | null): Promise<LoginUserInfoResult> {
  if (!authorization || !/^Bearer [A-Za-z0-9._~+\/-]{16,2048}={0,2}$/i.test(authorization)) {
    return { ok: false, status: 401 };
  }
  try {
    const response = await fetch("https://api.webflow.com/v2/token/authorized_by", {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, status: response.status === 401 || response.status === 403 ? 401 : response.status === 429 ? 503 : 502 };
    const parsed = userSchema.safeParse(await response.json());
    if (!parsed.success) return { ok: false, status: 502 };
    const user = parsed.data;
    return { ok: true, user: {
      sub: user.id, email: user.email,
      // Webflow does not supply proof of email verification. Never fabricate it.
      email_verified: false,
      name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    } };
  } catch { return { ok: false, status: 502 }; }
}
