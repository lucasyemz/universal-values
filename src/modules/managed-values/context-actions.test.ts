import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), link: vi.fn() }));
vi.mock("./sync-service", () => ({ loadManagedSyncValue: mocks.load }));
vi.mock("@/modules/routes/links", () => ({ resourceLink: mocks.link }));
import { loadManagedContext } from "./context-actions";
const siteId = "11111111-1111-4111-8111-111111111111", valueId = "22222222-2222-4222-8222-222222222222";
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });
it("returns a bounded page of saved sources, keeps uncertainty and makes no external request", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  mocks.load.mockResolvedValue({ value: { id: valueId, site_id: siteId }, bindings: Array.from({ length: 25 }, (_, n) => ({ id: n, source_value: "saved", uncertain: n === 10 })), history: [] });
  mocks.link.mockResolvedValue("/dashboard/alice/sites/site/managed-values/1");
  const view = await loadManagedContext({ siteId, valueId, page: 2 });
  expect(view.ok).toBe(true);
  if (view.ok) { expect(view.sources).toHaveLength(10); expect(view.sources[0]?.uncertain).toBe(true); expect(view.total).toBe(25); expect(view.hasMore).toBe(true); }
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not expose another site's value or accept invalid paging", async () => {
  mocks.load.mockResolvedValue({ value: { site_id: "other" } });
  expect(await loadManagedContext({ siteId, valueId, page: 1 })).toEqual({ ok: false });
  expect(await loadManagedContext({ siteId, valueId, page: 0 })).toEqual({ ok: false });
  expect(mocks.load).toHaveBeenCalledTimes(1); expect(mocks.link).not.toHaveBeenCalled();
});
it("keeps archived, uncertain-history and active-operation editing safeguards", async () => {
  for (const extra of [{ value: { id: valueId, site_id: siteId, archived_at: "today" }, archivedBindings: [] }, { activeOperation: { status: "confirmed" } }, { missingMigration: true }]) {
    mocks.load.mockResolvedValue({ value: { id: valueId, site_id: siteId }, bindings: [{ id: "binding" }], history: [], ...extra });
    const view = await loadManagedContext({ siteId, valueId, page: 1 });
    expect(view.ok && view.disabled).toBe(true);
  }
});
