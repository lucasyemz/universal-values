import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getScan: vi.fn(), getScanSite: vi.fn(), requireUser: vi.fn() }));
vi.mock("./service", () => ({ getScan: mocks.getScan, getScanSite: mocks.getScanSite }));
vi.mock("@/modules/auth/service", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));
import { confirmRepeat, loadRepeatScan, repeatDigest } from "./repeat-service";
import type { Scan } from "./schema";
const scan = { id: "old", site_id: "site", actor_id: "actor", connection_id: "connection", status: "limited", plan: [{ id: "a".repeat(24), name: "CMS", types: ["text", "number"], searchText: "2000", placeholders: true, searchOptions: { ignoreCase: true, ignoreAccents: false, wholeWord: true } }] } as Scan;
const rpc = vi.fn();
beforeEach(() => {
  mocks.getScan.mockResolvedValue(scan); mocks.getScanSite.mockResolvedValue({ id: "site", connection_id: "connection" });
  mocks.requireUser.mockResolvedValue({ user: { id: "actor" }, client: { rpc } }); rpc.mockResolvedValue({ error: null });
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });
it("copies the exact persisted plan through preview and confirmation with the same operation key, without provider access", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const input = { id: "new", scanId: "old", digest: repeatDigest(scan) };
  await confirmRepeat(input); await confirmRepeat(input);
  expect(rpc.mock.calls.map(call => call[0])).toEqual(["preview_cms_scan", "confirm_cms_scan", "preview_cms_scan", "confirm_cms_scan"]);
  expect(rpc.mock.calls[0]?.[1]).toEqual({ p_id: "new", p_site_id: "site", p_plan: scan.plan, p_truncated: false });
  expect(rpc.mock.calls[2]?.[1]).toEqual(rpc.mock.calls[0]?.[1]); expect(fetcher).not.toHaveBeenCalled();
});
it("rejects stale summary, changed connection and running source before mutations", async () => {
  await expect(confirmRepeat({ id: "new", scanId: "old", digest: "stale" })).rejects.toThrow("configuração");
  mocks.getScanSite.mockResolvedValue({ id: "site", connection_id: "changed" });
  await expect(confirmRepeat({ id: "new", scanId: "old", digest: repeatDigest(scan) })).rejects.toThrow("conexão");
  mocks.getScan.mockResolvedValue({ ...scan, status: "running" });
  await expect(confirmRepeat({ id: "new", scanId: "old", digest: repeatDigest(scan) })).rejects.toThrow("indisponível");
  expect(rpc).not.toHaveBeenCalled();
});
it("does not confirm a failed preview", async () => {
  rpc.mockResolvedValueOnce({ error: { message: "quota" } });
  await expect(confirmRepeat({ id: "new", scanId: "old", digest: repeatDigest(scan) })).rejects.toThrow("limite");
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("resolves repeat numbers within current account and site and never mutates on open", async () => {
  const eq = vi.fn(); const chain = { select: () => chain, eq, maybeSingle: async () => ({ data: { resource_id: "old" }, error: null }) }; eq.mockReturnValue(chain);
  mocks.requireUser.mockResolvedValue({ user: { id: "actor" }, client: { from: () => chain, rpc } });
  expect(await loadRepeatScan("site", "12")).toEqual(scan);
  expect(eq.mock.calls).toEqual([["site_id", "site"], ["account_id", "actor"], ["kind", "scans"], ["number", 12]]);
  mocks.getScan.mockResolvedValue({ ...scan, site_id: "other" });
  await expect(loadRepeatScan("site", "12")).rejects.toThrow("not found"); expect(rpc).not.toHaveBeenCalled();
});
