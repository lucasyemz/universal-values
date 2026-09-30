import { beforeEach, expect, it, vi } from "vitest";
const { rpc, usage, preview } = vi.hoisted(() => ({ rpc: vi.fn(), usage: vi.fn(), preview: vi.fn() }));
vi.mock("@/modules/plans/service", () => ({ getPlanUsage: usage }));
vi.mock("./service", () => ({ getWorkspacePreview: preview }));
vi.mock("@/modules/auth/service", () => ({ requireUser: async () => ({ client: { rpc } }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createWorkspace, confirmWorkspace } from "./actions";
const id = "11111111-1111-4111-8111-111111111111";
const form = () => { const input = new FormData(); input.set("id", id); input.set("name", "New workspace"); return input; };
beforeEach(() => { vi.resetAllMocks(); usage.mockResolvedValue({plan:"free",sites:0}); preview.mockResolvedValue(null); rpc.mockResolvedValue({ data: id, error: null }); });
it("creates immediately using the persisted idempotent operation without a review redirect", async () => {
  await expect(createWorkspace(form())).rejects.toThrow(`/dashboard/workspaces/${id}/settings/webflow`);
  expect(rpc.mock.calls).toEqual([
    ["preview_workspace", { p_id: id, p_name: "New workspace" }],
    ["confirm_workspace", { p_id: id }],
  ]);
});
it("does not confirm invalid input or failed preparation", async () => {
  await expect(createWorkspace(new FormData())).rejects.toThrow("error=invalid");
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
  await expect(createWorkspace(form())).rejects.toThrow("error=preview");
  expect(rpc).toHaveBeenCalledTimes(1);
});

it("rejects creation when the account site allowance is full", async () => {
  usage.mockResolvedValue({plan:"free",sites:2});
  await expect(createWorkspace(form())).rejects.toThrow("quota_sites");
  const confirmation = form(); confirmation.set("confirmed", "yes");
  await expect(confirmWorkspace(confirmation)).rejects.toThrow("quota_sites");
  expect(rpc).not.toHaveBeenCalled();
});
it("allows administrators and preserves completed operation replay", async () => {
  usage.mockResolvedValue({plan:"admin",sites:100});
  await expect(createWorkspace(form())).rejects.toThrow(`/dashboard/workspaces/${id}/settings/webflow`);
  usage.mockResolvedValue({plan:"free",sites:2});
  preview.mockResolvedValue({workspace_id:id});
  const confirmation = form(); confirmation.set("confirmed", "yes");
  await expect(confirmWorkspace(confirmation)).rejects.toThrow(`/dashboard/workspaces/${id}/settings/webflow`);
});
