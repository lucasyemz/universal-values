import { afterEach, expect, it, vi } from "vitest";
import { readWebflowLoginUser } from "./login-userinfo";
import { providerSchema } from "@/modules/auth/schema";
import { webflowLoginEnabled } from "@/modules/auth/providers";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const authorization = "Bearer synthetic-test-token-123456";
it("rejects missing, malformed and oversized credentials before contacting Webflow", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  for (const value of [null, "", "Basic abc", "Bearer token\r\nInjected: value", `Bearer ${"a".repeat(2050)}`]) {
    expect(await readWebflowLoginUser(value)).toEqual({ ok: false, status: 401 });
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it("maps the stable user ID without declaring email verified or exposing upstream extras", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "a".repeat(24), email: "test@example.com", firstName: "Test", lastName: "User", email_verified: true, token: "never-forward" }));
  vi.stubGlobal("fetch", fetcher);
  expect(await readWebflowLoginUser(authorization)).toEqual({ ok: true, user: { sub: "a".repeat(24), email: "test@example.com", email_verified: false, name: "Test User" } });
  expect(fetcher).toHaveBeenCalledWith("https://api.webflow.com/v2/token/authorized_by", expect.objectContaining({ cache: "no-store", redirect: "error", headers: { Authorization: authorization, Accept: "application/json" } }));
});
it("fails closed for missing identity fields and upstream failures without exposing response bodies", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValueOnce(Response.json({ email: "test@example.com" }));
  expect(await readWebflowLoginUser(authorization)).toEqual({ ok: false, status: 502 });
  for (const status of [401, 403, 429, 500]) {
    fetcher.mockResolvedValueOnce(new Response("sensitive upstream details", { status }));
    expect(await readWebflowLoginUser(authorization)).toEqual({ ok: false, status: status === 429 ? 503 : status < 429 ? 401 : 502 });
  }
  fetcher.mockRejectedValueOnce(new Error("network failure"));
  expect(await readWebflowLoginUser(authorization)).toEqual({ ok: false, status: 502 });
});
it("only accepts the named Webflow provider and requires explicit enablement", () => {
  expect(providerSchema.parse("custom:webflow")).toBe("custom:webflow");
  expect(providerSchema.safeParse("custom:untrusted").success).toBe(false);
  vi.stubEnv("WEBFLOW_LOGIN_ENABLED", "false"); expect(webflowLoginEnabled()).toBe(false);
  vi.stubEnv("WEBFLOW_LOGIN_ENABLED", "true"); expect(webflowLoginEnabled()).toBe(true);
});
