import { afterEach, expect, it, vi } from "vitest";
import { webflowUserInfoHandler } from "./login-userinfo-handler";

afterEach(() => vi.unstubAllGlobals());

it("rejects methods and query credentials without provider reads", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const post = await webflowUserInfoHandler(new Request("https://example.com", { method: "POST" }));
  expect(post.status).toBe(405);
  expect(post.headers.get("allow")).toBe("GET");
  const query = await webflowUserInfoHandler(new Request("https://example.com?access_token=synthetic"));
  expect(query.status).toBe(401);
  expect(query.headers.get("cache-control")).toBe("private, no-store");
  expect(fetcher).not.toHaveBeenCalled();
});

it("returns only validated identity with unverified email and no caching", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
    id: "a".repeat(24), email: "test@example.com", firstName: "Test", secret: "not-returned",
  })));
  const response = await webflowUserInfoHandler(new Request("https://example.com", {
    headers: { Authorization: "Bearer synthetic-token-123456" },
  }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(await response.json()).toEqual({ sub: "a".repeat(24), email: "test@example.com", email_verified: false, name: "Test" });
});

it("does not expose provider error bodies", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private upstream detail", { status: 429 })));
  const response = await webflowUserInfoHandler(new Request("https://example.com", {
    headers: { Authorization: "Bearer synthetic-token-123456" },
  }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "identity_unavailable" });
});
