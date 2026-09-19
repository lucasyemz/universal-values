import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/modules/auth/service", () => ({ requireUser: vi.fn() }));
import { requireUser } from "@/modules/auth/service";
import { getActivity } from "./actions";
import { changeActivity, scanActivity } from "./model";
const id = "11111111-1111-4111-8111-111111111111";
const row = { id, site_id: id, status: "confirmed", cursor: 1, total: 2, background_paused: false, managed_value_id: null, results: [{ status: "applied" }] };
beforeEach(() => vi.clearAllMocks());
describe("activity status", () => {
  it("does not describe queued or paused work as completed", () => {
    expect(changeActivity(row, "Site")).toMatchObject({ state: "active", label: "Na fila / processando", current: 1, total: 2 });
    expect(changeActivity({ ...row, background_paused: true }, "Site").state).toBe("attention");
  });
  it("keeps uncertain completed outcomes visible as needing attention", () => {
    expect(changeActivity({ ...row, status: "completed", results: [{ status: "uncertain" }] }, "Site")).toMatchObject({ state: "attention", label: "Concluída com pendências" });
    expect(changeActivity({ ...row, status: "completed", results: [{ status: "already_applied" }] }, "Site").state).toBe("done");
  });
  it("does not treat a limited scan as fully successful", () => {
    expect(scanActivity({ id, site_id: id, status: "limited", items_read: 20, occurrences_count: 4 }, "Site")).toMatchObject({ state: "attention", label: "Scan atingiu o limite" });
  });
});
describe("read-only activity query", () => {
  it("validates tracked IDs before querying", async () => {
    expect(await getActivity({ changes: ["invalid),status.eq.preview"], scans: [] })).toMatchObject({ ok: false });
    expect(requireUser).not.toHaveBeenCalled();
  });
  it("scopes both queues to the user and only calls the health RPC", async () => {
    const query = (data: unknown[]) => {
      const q = { select: vi.fn(), eq: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), in: vi.fn() };
      for (const method of [q.select, q.eq, q.or, q.order]) method.mockReturnValue(q);
      q.limit.mockResolvedValue({ data, error: null }); q.in.mockResolvedValue({ data, error: null });
      return q;
    };
    const changes = query([row]); const scans = query([]); const sites = query([{ id, display_name: "Meu site" }]);
    const rpc = vi.fn().mockResolvedValue({ data: new Date().toISOString(), error: null });
    const from = vi.fn((table: string) => table === "cms_change_requests" ? changes : table === "cms_scans" ? scans : sites);
    vi.mocked(requireUser).mockResolvedValue({ user: { id }, client: { from, rpc } } as unknown as Awaited<ReturnType<typeof requireUser>>);
    expect(await getActivity({ changes: [id], scans: [] })).toMatchObject({ ok: true, worker: "online", items: [{ site: "Meu site" }] });
    expect(changes.eq).toHaveBeenCalledWith("actor_id", id); expect(scans.eq).toHaveBeenCalledWith("actor_id", id);
    expect(changes.or).toHaveBeenCalledWith(`status.eq.confirmed,id.in.(${id})`);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("cms_worker_last_seen", {});
  });
});
