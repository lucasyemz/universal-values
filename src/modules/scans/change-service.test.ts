import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/service", () => ({ requireUser: vi.fn() }));
vi.mock("@/modules/sites/service", () => ({ getConnectionReader: vi.fn() }));
vi.mock("./service", () => ({ getScan: vi.fn(), getScanSite: vi.fn() }));
import { requireUser } from "@/modules/auth/service";
import { getConnectionReader } from "@/modules/sites/service";
import { getScanSite } from "./service";
import { WebflowError } from "@/connectors/webflow/client";
import { processChangeStep } from "./change-service";

const id = "11111111-1111-4111-8111-111111111111";
const collection = "a".repeat(24), itemId = "b".repeat(24), remoteSite = "c".repeat(24);
const occurrence = { id, scan_id: id, site_id: id, source_key: "source", collection_id: collection, collection_name: "CMS", item_id: itemId, item_name: "Item", locale: "", field_slug: "link", field_name: "Link", field_type: "Link", source_value: "/old", raw_match: "/old", start_pos: 0, end_pos: 4, canonical: { type: "link", url: "/old" } };
function setup(status = "confirmed", dispatched = false, current = "/old", reverting = false, managed = false, uncertain = false) {
  const binding = { id, managed_value_id: id, site_id: id, workspace_id: id, source_key: "source", collection_id: collection, item_id: itemId, locale: "", field_slug: "link", field_type: "Link", source_value: "/old", locations: [{ start: 0, end: 4, raw: "/old" }], canonical: { type: "link", url: "/old" }, uncertain, last_synced_at: null };
  const request = { id, scan_id: managed ? null : id, managed_value_id: managed ? id : null, managed_version: managed ? 1 : null, managed_after: managed ? { type: "link", url: "/new" } : null, managed_snapshot: managed ? [binding] : null, site_id: id, workspace_id: id, actor_id: id, connection_id: id, changes: [{ occurrenceId: id, after: { type: "link", url: "/new" } }], status, cursor: 0, total: 1, dispatched, lease_until: null, retry_at: null, expires_at: "2099-01-01T00:00:00Z", results: [] as unknown[] };
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
  const writer = { updateField: vi.fn(async () => { if (managed) item.fieldData.link = "/new"; return { ...item, fieldData: { link: "/new" } }; }) };
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


describe("Managed Value field execution", () => {
  it("never writes an unconfirmed Managed Value preview", async () => {
    const { writer, reader, rpc } = setup("preview", false, "/old", false, true);
    expect((await processChangeStep(id, 0)).status).toBe("preview");
    expect(writer.updateField).not.toHaveBeenCalled(); expect(reader.item).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  });
  it("re-reads the field and records new binding positions only after verification", async () => {
    const { writer, reader, rpc } = setup("confirmed", false, "/old", false, true);
    expect((await processChangeStep(id, 0)).results[0]).toMatchObject({ status: "applied", bindingSource: "/new", bindingLocations: [{ start: 0, end: 4, raw: "/new" }] });
    expect(reader.item).toHaveBeenCalledTimes(2); expect(writer.updateField).toHaveBeenCalledTimes(1);
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(writer.updateField.mock.invocationCallOrder[0]!);
  });
  it("keeps a successful write uncertain if subsequent verification fails or is rate limited", async () => {
    const first = setup("confirmed", false, "/old", false, true);
    first.reader.item.mockResolvedValueOnce({ id: itemId, isDraft: false, isArchived: false, fieldData: { link: "/old" } }).mockResolvedValueOnce({ id: itemId, isDraft: false, isArchived: false, fieldData: { link: "/different" } });
    expect((await processChangeStep(id, 0)).results[0]).toMatchObject({ status: "uncertain" });
    const second = setup("confirmed", false, "/old", false, true);
    second.reader.item.mockResolvedValueOnce({ id: itemId, isDraft: false, isArchived: false, fieldData: { link: "/old" } }).mockRejectedValueOnce(new WebflowError("rate_limit", 60));
    const result = (await processChangeStep(id, 0)).results[0];
    expect(result?.status).toBe("uncertain"); expect(result?.bindingSource).toBeUndefined();
  });
  it("does not dispatch a binding that was uncertain in a previous request", async () => {
    const blocked = setup("confirmed", false, "/old", false, true, true);
    expect((await processChangeStep(id, 0)).results[0]?.status).toBe("uncertain"); expect(blocked.writer.updateField).not.toHaveBeenCalled();
    const reconciled = setup("confirmed", false, "/new", false, true, true);
    expect((await processChangeStep(id, 0)).results[0]).toMatchObject({ status: "already_applied", bindingSource: "/new" }); expect(reconciled.writer.updateField).not.toHaveBeenCalled();
  });
  it("reloads the durable dispatch marker after claiming a lease", async () => {
    const { rpc, request, writer } = setup("confirmed", false, "/old", false, true);
    const original = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (name, args) => { if (name === "claim_cms_change") request.dispatched = true; return original(name, args); });
    expect((await processChangeStep(id, 0)).results[0]?.status).toBe("uncertain"); expect(writer.updateField).not.toHaveBeenCalled();
  });
});

describe("rebased Managed Value conflict resolution execution", () => {
  it("writes only against reviewed external content and blocks another external edit", async () => {
    const first=setup("confirmed",false,"/external",false,true);
    const binding=first.request.managed_snapshot![0]!;
    binding.source_value="/external"; binding.canonical.url="/external"; binding.locations=[{start:0,end:9,raw:"/external"}];
    expect((await processChangeStep(id,0)).results[0]?.status).toBe("applied");
    expect(first.writer.updateField).toHaveBeenCalledOnce();
    const second=setup("confirmed",false,"/changed-again",false,true);
    const other=second.request.managed_snapshot![0]!;
    other.source_value="/external"; other.canonical.url="/external"; other.locations=[{start:0,end:9,raw:"/external"}];
    expect((await processChangeStep(id,0)).results[0]?.status).toBe("conflict");
    expect(second.writer.updateField).not.toHaveBeenCalled();
  });
});
