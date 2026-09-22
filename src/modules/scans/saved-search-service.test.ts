import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getScanSite: vi.fn(), resourceLink: vi.fn() }));
vi.mock("@/modules/auth/service", () => ({ requireUser: mocks.requireUser }));
vi.mock("./service", () => ({ getScanSite: mocks.getScanSite }));
vi.mock("@/modules/routes/links", () => ({ resourceLink: mocks.resourceLink }));
import { searchSavedScans } from "./saved-search-service";
const id = "11111111-1111-4111-8111-111111111111", actor = "22222222-2222-4222-8222-222222222222";
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
it("queries saved rows with actor/site/status bounds and no credential, Edge or provider call", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const eq = vi.fn(), inside = vi.fn(), limit = vi.fn().mockResolvedValue({ data: [], error: null });
  const chain = { select: () => chain, eq, in: inside, order: () => chain, limit };
  eq.mockReturnValue(chain); inside.mockReturnValue(chain);
  const rpc = vi.fn(); mocks.requireUser.mockResolvedValue({ user: { id: actor }, client: { from: () => chain, rpc } });
  const result = await searchSavedScans(id, "Acme");
  expect(mocks.getScanSite).toHaveBeenCalledWith(id);
  expect(eq.mock.calls).toEqual([["site_id", id], ["actor_id", actor]]);
  expect(inside).toHaveBeenCalledWith("status", ["completed", "limited"]);
  expect(limit).toHaveBeenCalledWith(20);
  expect(result?.scan).toBeNull(); expect(rpc).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
});
it("does no work for empty input and stops before scan lookup if site access fails", async () => {
  expect(await searchSavedScans(id, " ")).toBeNull(); expect(mocks.requireUser).not.toHaveBeenCalled();
  mocks.getScanSite.mockRejectedValue(new Error("denied"));
  await expect(searchSavedScans(id, "Acme")).rejects.toThrow("denied"); expect(mocks.requireUser).not.toHaveBeenCalled();
});
