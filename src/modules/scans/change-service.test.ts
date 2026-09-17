import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/service", () => ({ requireUser: vi.fn() }));
vi.mock("@/modules/sites/service", () => ({ getConnectionReader: vi.fn() }));
vi.mock("./service", () => ({ getScan: vi.fn(), getScanSite: vi.fn() }));
import { requireUser } from "@/modules/auth/service";
import { getConnectionReader } from "@/modules/sites/service";
import { getScanSite } from "./service";
import { processChangeStep } from "./change-service";

const id = "11111111-1111-4111-8111-111111111111";
const collection = "a".repeat(24), itemId = "b".repeat(24), remoteSite = "c".repeat(24);
const occurrence = { id, scan_id: id, site_id: id, source_key: "source", collection_id: collection, collection_name: "CMS", item_id: itemId, item_name: "Item", locale: "", field_slug: "link", field_name: "Link", field_type: "Link", source_value: "/old", raw_match: "/old", start_pos: 0, end_pos: 4, canonical: { type: "link", url: "/old" } };
function setup(status = "confirmed", dispatched = false, current = "/old", reverting = false) {
  const request = { id, scan_id: id, site_id: id, workspace_id: id, actor_id: id, connection_id: id, changes: [{ occurrenceId: id, after: { type: "link", url: "/new" } }], status, cursor: 0, total: 1, dispatched, lease_until: null, retry_at: null, expires_at: "2099-01-01T00:00:00Z", results: [] as unknown[] };
  const originalId = "22222222-2222-4222-8222-222222222222";
  const parent = { ...request, id: originalId, reverts_request_id: null, status: "completed", cursor: 1, results: [{ sourceKey: "source", status: "applied", message: "Applied", actual: "/new" }] };
  const query = (table: string) => {
    let targetId = id;
    const chain = { select: () => chain, eq: (key: string, value: string) => { if (key === "id") targetId = value; return chain; }, in: () => chain, maybeSingle: async () => ({ data: targetId === originalId ? parent : { ...request, reverts_request_id: reverting ? originalId : null }, error: null }), limit: async () => ({ data: table === "scan_occurrences" ? [occurrence] : [], error: null }) };
    return chain;
  };
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "claim_cms_change") return { data: true, error: null };
    if (name === "dispatch_cms_change") { request.dispatched = true; return { data: true, error: null }; }
    if (name === "finish_cms_change") { request.results.push(args.p_result); request.cursor = 1; request.status = "completed"; }
    return { data: id, error: null };
  });
  const item = { id: itemId, isDraft: false, isArchived: false, fieldData: { link: current } };
  const writer = { updateField: vi.fn(async () => ({ ...item, fieldData: { link: "/new" } })) };
  const reader = { sites: vi.fn(async () => [{ id: remoteSite }]), collections: vi.fn(async () => [{ id: collection }]), collection: vi.fn(async () => ({ id: collection, fields: [{ slug: "link", type: "Link" }] })), item: vi.fn(async () => item) };
  vi.mocked(requireUser).mockResolvedValue({ user: { id }, client: { from: query, rpc } } as unknown as Awaited<ReturnType<typeof requireUser>>);
  vi.mocked(getScanSite).mockResolvedValue({ id, workspace_id: id, connection_id: id, webflow_site_id: remoteSite, display_name: "Site" });
  vi.mocked(getConnectionReader).mockResolvedValue({ connection: { workspace_id: id }, reader, writer } as unknown as Awaited<ReturnType<typeof getConnectionReader>>);
  return { request, rpc, writer, reader };
}
beforeEach(() => vi.clearAllMocks());
describe("confirmed field execution", () => {
  it("restores the original value and rejects edits made after the original operation", async () => {
    const first = setup("confirmed", false, "/new", true);
    first.writer.updateField.mockResolvedValue({ id: itemId, isDraft: false, isArchived: false, fieldData: { link: "/old" } });
    expect((await processChangeStep(id, 0)).results[0]?.status).toBe("applied");
    expect(first.writer.updateField).toHaveBeenCalledWith(expect.objectContaining({ value: "/old" }));
    const second = setup("confirmed", false, "/edited-later", true);
    expect((await processChangeStep(id, 0)).results[0]?.status).toBe("conflict");
    expect(second.writer.updateField).not.toHaveBeenCalled();
    const third = setup("confirmed", false, "/old", true);
    expect((await processChangeStep(id, 0)).results[0]?.status).toBe("already_applied");
    expect(third.writer.updateField).not.toHaveBeenCalled();
  });
  it("never calls the provider for an unconfirmed preview", async () => {
    const { rpc, writer, reader } = setup("preview");
    expect((await processChangeStep(id, 0)).status).toBe("preview");
    expect(rpc).not.toHaveBeenCalled(); expect(writer.updateField).not.toHaveBeenCalled(); expect(reader.item).not.toHaveBeenCalled();
  });
  it("blocks externally changed fields and skips already applied values", async () => {
    for (const [current, status] of [["/external", "conflict"], ["/new", "already_applied"]]) {
      const { writer } = setup("confirmed", false, current);
      expect((await processChangeStep(id, 0)).results[0]?.status).toBe(status);
      expect(writer.updateField).not.toHaveBeenCalled();
    }
  });
  it("records a durable dispatch before writing and finishes with the observed result", async () => {
    const { writer, rpc } = setup();
    expect((await processChangeStep(id, 0)).results[0]).toMatchObject({ status: "applied", actual: "/new" });
    expect(rpc.mock.calls.findIndex(([name]) => name === "dispatch_cms_change")).toBeGreaterThan(-1);
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(writer.updateField.mock.invocationCallOrder[0]!);
    expect(writer.updateField).toHaveBeenCalledTimes(1);
  });
  it("does not resend an uncertain write on recovery", async () => {
    const { writer } = setup("confirmed", true);
    expect((await processChangeStep(id, 0)).results[0]?.status).toBe("uncertain");
    expect(writer.updateField).not.toHaveBeenCalled();
  });
  it("marks response loss as uncertain and never claims success", async () => {
    const { writer } = setup();
    writer.updateField.mockRejectedValue(new Error("timeout"));
    expect((await processChangeStep(id, 0)).results[0]?.status).toBe("uncertain");
    expect(writer.updateField).toHaveBeenCalledTimes(1);
  });
  it("fails closed when durable dispatch cannot be recorded", async () => {
    const { rpc, writer } = setup();
    rpc.mockImplementation(async (name) => ({ data: name === "claim_cms_change" ? true : false, error: null }));
    await processChangeStep(id, 0);
    expect(writer.updateField).not.toHaveBeenCalled();
  });
});
