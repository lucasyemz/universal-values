import { describe, expect, it, vi } from "vitest";
import { WebflowReader, exchangeCode } from "./client";
import { authorizationUrl, getWebflowConfig, type WebflowConfig } from "./config";
import { decryptToken, encryptToken, hashOAuthState, newOAuthState, verifyOAuthState } from "./crypto";

const config: WebflowConfig = {
  clientId: "client", clientSecret: "secret-not-for-browser",
  redirectUri: "http://localhost:3000/api/connectors/webflow/callback", encryptionKey: "ab".repeat(32),
};
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const siteId = "0123456789abcdef01234567";
const collectionId = "abcdef0123456789abcdef01";
const site = { id: siteId, displayName: "Site", shortName: "site" };

describe("Webflow read connector", () => {
  it("requests CMS write access without publication or site-write scopes", () => {
    const url = new URL(authorizationUrl(config, "state"));
    expect(url.origin).toBe("https://webflow.com");
    expect(url.searchParams.get("scope")).toBe("sites:read cms:read cms:write");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("state")).toBe("state");
    expect(url.toString()).not.toContain(config.clientSecret);
  });

  it("validates environment configuration and requires a callback on a safe origin", () => {
    vi.stubEnv("WEBFLOW_CLIENT_ID", config.clientId);
    vi.stubEnv("WEBFLOW_CLIENT_SECRET", config.clientSecret);
    vi.stubEnv("WEBFLOW_TOKEN_ENCRYPTION_KEY", config.encryptionKey);
    for (const uri of ["", "http://example.com/api/connectors/webflow/callback", "https://app.com/wrong", config.redirectUri + "?next=evil"]) {
      vi.stubEnv("WEBFLOW_REDIRECT_URI", uri);
      expect(getWebflowConfig()).toBeNull();
    }
    vi.stubEnv("WEBFLOW_REDIRECT_URI", config.redirectUri);
    expect(getWebflowConfig()).toEqual(config);
    vi.unstubAllEnvs();
  });

  it("binds random OAuth state to the browser cookie", () => {
    const state = newOAuthState(id);
    expect(state).not.toBe(newOAuthState(id));
    expect(verifyOAuthState(state, state)).toBe(id);
    expect(verifyOAuthState(state, newOAuthState(id))).toBeNull();
    expect(verifyOAuthState(state, undefined)).toBeNull();
    expect(verifyOAuthState("bad", "bad")).toBeNull();
    expect(hashOAuthState(state)).toHaveLength(64);
  });

  it("encrypts credentials with tenant-bound authentication", () => {
    const context = id + ":workspace:actor";
    const token = "sensitive-access-token";
    const encrypted = encryptToken(token, context, config.encryptionKey);
    expect(encrypted).not.toContain(token);
    expect(encrypted).not.toBe(encryptToken(token, context, config.encryptionKey));
    expect(decryptToken(encrypted, context, config.encryptionKey)).toBe(token);
    expect(() => decryptToken(encrypted, "another-workspace", config.encryptionKey)).toThrow();
    expect(() => decryptToken(encrypted, context, "cd".repeat(32))).toThrow();
    const parts = encrypted.split(".");
    parts[3] = "00" + parts[3]!.slice(2);
    expect(() => decryptToken(parts.join("."), context, config.encryptionKey)).toThrow();
  });

  it("uses only GET, disables caching and blocks redirects for site reads", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ sites: [site] }));
    expect(await new WebflowReader("token", fetcher).sites()).toEqual([site]);
    expect(fetcher).toHaveBeenCalledWith("https://api.webflow.com/v2/sites", expect.objectContaining({
      method: "GET", redirect: "error", cache: "no-store",
    }));
  });

  it("paginates items without crawling the entire CMS", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [], pagination: { limit: 25, offset: 25, total: 50 } }));
    await new WebflowReader("token", fetcher).items(collectionId, 25);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.webflow.com/v2/collections/" + collectionId + "/items?limit=25&offset=25");
    await expect(new WebflowReader("token", fetcher).items(collectionId, -1)).rejects.toThrow();
  });

  it("rejects path injection before issuing a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(new WebflowReader("token", fetcher).collections("../sites")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("validates response payloads", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ sites: [{ id: "wrong" }] }));
    await expect(new WebflowReader("token", fetcher).sites()).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("handles revocation without including provider response secrets", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("secret-provider-body", { status: 401 }));
    await expect(new WebflowReader("token", fetcher).sites()).rejects.toMatchObject({ kind: "unauthorized", message: "Webflow request failed: unauthorized" });
  });

  it("exposes Retry-After without immediate retries", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "90" } }));
    await expect(new WebflowReader("token", fetcher).sites()).rejects.toMatchObject({ kind: "rate_limit", retryAfter: 90 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("exchanges a code once using the same redirect URI", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ access_token: "result-token" }));
    expect(await exchangeCode(config, "one-use-code", fetcher)).toBe("result-token");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const options = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(options?.body as string)).toMatchObject({ redirect_uri: config.redirectUri, code: "one-use-code" });
    expect(options?.redirect).toBe("error");
  });
});
