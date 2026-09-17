import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); } }));
vi.mock("@/modules/auth/service", () => ({ requireUser: vi.fn() }));
vi.mock("./service", () => ({ loadScanResults: vi.fn() }));
vi.mock("./change-service", () => ({ loadChangeRequest: vi.fn(), processChangeStep: vi.fn() }));
import { requireUser } from "@/modules/auth/service";
import { loadChangeRequest } from "./change-service";
import { retryFailedChanges } from "./change-actions";

const id = "11111111-1111-4111-8111-111111111111", retryId = "22222222-2222-4222-8222-222222222222";
function setup(status = "completed", resultStatus = "failed", retryAt: string | null = null) {
  const change = { occurrenceId: id, after: { type: "link", url: "/new" } };
  vi.mocked(loadChangeRequest).mockResolvedValue({ request: { id, scan_id: id, status, retry_at: retryAt, changes: [change], results: [{ sourceKey: "field", status: resultStatus }] }, plan: [{ sourceKey: "field", occurrenceIds: [id] }] } as unknown as Awaited<ReturnType<typeof loadChangeRequest>>);
  const rpc = vi.fn().mockResolvedValue({ data: retryId, error: null });
  vi.mocked(requireUser).mockResolvedValue({ client: { rpc } } as unknown as Awaited<ReturnType<typeof requireUser>>);
  const form = new FormData(); form.set("id", id); form.set("retryId", retryId);
  return { rpc, form, change };
}
beforeEach(() => vi.clearAllMocks());
describe("retry preview action", () => {
  it("creates only an audited preview with the existing values and the same operation key on replay", async () => {
    const { rpc, form, change } = setup();
    for (let i = 0; i < 2; i++) await expect(retryFailedChanges(form)).rejects.toThrow("redirect:/dashboard/changes/" + retryId);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "preview_cms_changes", { p_id: retryId, p_scan_id: id, p_changes: [change] });
    expect(rpc).toHaveBeenNthCalledWith(2, "preview_cms_changes", { p_id: retryId, p_scan_id: id, p_changes: [change] });
    // No confirmation or dispatch is called: explicit confirmation happens on the new page.
  });
  it.each([
    ["confirmed", "failed", null, "retry_active"],
    ["completed", "uncertain", null, "retry_empty"],
    ["completed", "failed", "2099-01-01T00:00:00Z", "retry_wait"],
  ])("blocks ineligible request %s/%s", async (status, resultStatus, retryAt, error) => {
    const { rpc, form } = setup(status!, resultStatus!, retryAt);
    await expect(retryFailedChanges(form)).rejects.toThrow("?error=" + error);
    expect(rpc).not.toHaveBeenCalled();
  });
});
