import { describe, expect, it, vi } from "vitest";
import { handleWorkerRequest } from "./edge-handler";
import { edgeWorker } from "@/connectors/supabase/edge-worker";
const secret = "a".repeat(64);
function request(body = '{"mode":"run"}', token = secret) {
  return new Request("https://example.test/worker", { method: "POST", headers: { "x-worker-secret": token }, body });
}
const deps = () => ({ secret, check: vi.fn(async () => {}), run: vi.fn(async () => ({ idle: false, status: "applied" })) });
describe("bounded Edge worker", () => {
  it("rejects unauthenticated requests before accessing the queue", async () => {
    const d = deps();
    for (const token of ["", "public-key", "b".repeat(64)]) expect((await handleWorkerRequest(request(undefined, token), d)).status).toBe(401);
    expect(d.run).not.toHaveBeenCalled(); expect(d.check).not.toHaveBeenCalled();
  });
  it("fails closed when no scheduler secret is configured", async () => {
    expect((await handleWorkerRequest(request(), { ...deps(), secret: undefined })).status).toBe(503);
  });
  it("requires an explicit valid mode and refuses caller-supplied operation identity", async () => {
    const d = deps();
    for (const body of ['{}', 'invalid', '{"mode":"run","actor_id":"other"}']) expect((await handleWorkerRequest(request(body), d)).status).toBe(400);
    expect((await handleWorkerRequest(request("a".repeat(257)), d)).status).toBe(413);
    expect(d.run).not.toHaveBeenCalled();
  });
  it("check mode never reserves or executes work", async () => {
    const d = deps();
    expect(await (await handleWorkerRequest(request('{"mode":"check"}'), d)).json()).toEqual({ ok: true, mode: "check" });
    expect(d.check).toHaveBeenCalledOnce(); expect(d.run).not.toHaveBeenCalled();
  });
  it("runs only one step per invocation and excludes identity from responses", async () => {
    const d = deps();
    expect(await (await handleWorkerRequest(request(), d)).json()).toEqual({ ok: true, idle: false, status: "applied" });
    expect(d.run).toHaveBeenCalledOnce();
  });
  it("returns infrastructure failures without leaking credentials", async () => {
    const d = deps(); d.run.mockRejectedValue(new Error(secret));
    const result = await handleWorkerRequest(request(), d);
    expect(result.status).toBe(503); expect(await result.text()).not.toContain(secret);
  });
  it("does not construct a database connection for anonymous HTTP requests", async () => {
    expect((await edgeWorker(request(undefined, "invalid"), { CMS_WORKER_CRON_SECRET: secret })).status).toBe(401);
  });
});
