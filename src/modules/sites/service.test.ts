import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptToken } from "@/connectors/webflow/crypto";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/modules/auth/service", () => ({ requireUser }));
import { loadSiteContent } from "./service";

const actor = "11111111-1111-4111-8111-111111111111";
const workspace = "22222222-2222-4222-8222-222222222222";
const connection = "33333333-3333-4333-8333-333333333333";
const localSite = "44444444-4444-4444-8444-444444444444";
const remoteSite = "0123456789abcdef01234567";
const collection = "abcdef0123456789abcdef01";
const foreignCollection = "bbbbbbbbbbbbbbbbbbbbbbbb";
const key = "ab".repeat(32);
const fetcher = vi.fn<typeof fetch>();

function setupDatabase(connectionWorkspace = workspace, role = "owner") {
  const rows: Record<string, unknown> = {
    sites: { id: localSite, workspace_id: workspace, connection_id: connection, webflow_site_id: remoteSite, display_name: "Site" },
    webflow_connections: { id: connection, workspace_id: connectionWorkspace, actor_id: actor, status: "ready", expires_at: "2027-01-01T00:00:00Z" },
    workspace_members: { role },
  };
  const client = {
    from: (table: string) => {
      const chain = {
        select: () => chain, eq: () => chain,
        maybeSingle: async () => ({ data: rows[table], error: null }),
      };
      return chain;
    },
    rpc: vi.fn().mockResolvedValue({ data: encryptToken("test-token", ["webflow", connection, connectionWorkspace, actor].join(":"), key), error: null }),
  };
  requireUser.mockResolvedValue({ user: { id: actor }, client });
  return client;
}

beforeEach(() => {
  vi.stubEnv("WEBFLOW_CLIENT_ID", "client");
  vi.stubEnv("WEBFLOW_CLIENT_SECRET", "secret");
  vi.stubEnv("WEBFLOW_REDIRECT_URI", "http://localhost:3000/api/connectors/webflow/callback");
  vi.stubEnv("WEBFLOW_TOKEN_ENCRYPTION_KEY", key);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
  setupDatabase();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("CMS authorization boundary", () => {
  it("does not query a collection from another site even if the token could access it", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ sites: [{ id: remoteSite, displayName: "Site", shortName: "site" }] }));
    fetcher.mockResolvedValueOnce(Response.json({ collections: [{ id: collection, displayName: "Products", slug: "products" }] }));
    await expect(loadSiteContent(localSite, foreignCollection)).rejects.toThrow("NOT_FOUND");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes(foreignCollection))).toBe(false);
  });

  it("does not query CMS when site access is revoked", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ sites: [] }));
    await expect(loadSiteContent(localSite)).rejects.toMatchObject({ kind: "forbidden" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects a connection from another workspace before provider calls", async () => {
    setupDatabase("55555555-5555-4555-8555-555555555555");
    await expect(loadSiteContent(localSite)).rejects.toThrow("NOT_FOUND");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not retrieve credentials for a non-owner", async () => {
    const client = setupDatabase(workspace, "member");
    await expect(loadSiteContent(localSite)).rejects.toThrow("NOT_FOUND");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads collection fields and the requested item page after authorization", async () => {
    fetcher.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/sites")) return Response.json({ sites: [{ id: remoteSite, displayName: "Site", shortName: "site" }] });
      if (url.endsWith("/collections")) return Response.json({ collections: [{ id: collection, displayName: "Products", slug: "products" }] });
      if (url.includes("/items?")) return Response.json({ items: [], pagination: { total: 50, limit: 25, offset: 25 } });
      return Response.json({ id: collection, displayName: "Products", slug: "products", fields: [] });
    });
    const view = await loadSiteContent(localSite, collection, 25);
    expect(view.details?.id).toBe(collection);
    expect(view.page?.pagination.offset).toBe(25);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
