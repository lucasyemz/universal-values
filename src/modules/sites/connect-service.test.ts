import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { rpc, sites, credential, remember, existing } = vi.hoisted(() => ({ rpc: vi.fn(), sites: vi.fn(), credential: vi.fn(), remember: vi.fn(), existing: vi.fn() }));
vi.mock("./service", () => ({ getConnectionReader: credential }));
vi.mock("./metadata-service", () => ({ rememberConnectedSite: remember }));
vi.mock("@/modules/auth/service", () => ({ requireUser: async () => ({ user: { id: "actor" }, client: { rpc, from: () => ({ select: () => ({ eq: existing }) }) } }) }));
import { connectAuthorizedConnection } from "./connect-service";
import { connectionSiteKey } from "./connect-authorized";
const id = "11111111-1111-4111-8111-111111111111";
const site = { id: "a".repeat(24), displayName: "Test", shortName: "test" };
beforeEach(() => {
  vi.resetAllMocks();
  credential.mockResolvedValue({ connection: { workspace_id: id }, reader: { sites } });
  sites.mockResolvedValue([site]); existing.mockResolvedValue({ data: [], error: null });
  rpc.mockResolvedValue({ data: id, error: null }); remember.mockResolvedValue(undefined);
});
it("uses one authoritative provider read and the same operation key on retries", async () => {
  for (let i = 0; i < 2; i++) expect(await connectAuthorizedConnection(id)).toEqual({ connected: 1, failed: 0 });
  const prepares = rpc.mock.calls.filter(call => call[0] === "preview_webflow_site");
  expect(prepares[0]?.[1].p_id).toBe(connectionSiteKey(id, site.id));
  expect(prepares[1]?.[1].p_id).toBe(prepares[0]?.[1].p_id);
  expect(connectionSiteKey("other", site.id)).not.toBe(prepares[0]?.[1].p_id);
  expect(sites).toHaveBeenCalledTimes(2);
  expect(remember).toHaveBeenCalledWith(id, site);
});
it("fails before persistence for revoked access or unauthorized site IDs", async () => {
  credential.mockRejectedValueOnce(new Error("revoked"));
  await expect(connectAuthorizedConnection(id)).rejects.toThrow("revoked");
  await expect(connectAuthorizedConnection(id, "b".repeat(24))).rejects.toThrow("not authorized");
  expect(rpc).not.toHaveBeenCalled();
});
it("does not copy sites from another workspace", async () => {
  existing.mockResolvedValue({ data: [{ webflow_site_id: site.id, workspace_id: "other" }], error: null });
  expect(await connectAuthorizedConnection(id)).toEqual({ connected: 0, failed: 1, reasons: ["other_workspace"] });
  expect(rpc).not.toHaveBeenCalled();
  expect(existing).toHaveBeenCalledWith("account_id", "actor");
});
it("retains partial success without bypassing quota or failed preparation", async () => {
  sites.mockResolvedValue([site, { ...site, id: "b".repeat(24) }]);
  rpc.mockResolvedValueOnce({ error: { code: "quota" } });
  expect(await connectAuthorizedConnection(id)).toEqual({ connected: 1, failed: 1, reasons: ["prepare_failed"] });
  expect(rpc.mock.calls.filter(call => call[0] === "confirm_webflow_site")).toHaveLength(1);
});
it("does not report metadata cache failure as failed connection", async () => {
  remember.mockRejectedValue(new Error("cache unavailable"));
  expect(await connectAuthorizedConnection(id)).toEqual({ connected: 1, failed: 0 });
});
