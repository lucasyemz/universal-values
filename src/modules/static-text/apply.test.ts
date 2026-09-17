import { describe, expect, it, vi } from "vitest";
import { applyPlan, type AuditEvent, type AuditStore, type TextPort } from "./apply";
import { type TextPlan } from "./plan";

function fixture() {
  const context = { siteId: "s", pageId: "p", pageName: "Home", rootId: "root" };
  const plan: TextPlan = { id: crypto.randomUUID(), context, expiresAt: Date.now() + 60000, changes: [{ id: "a", before: "AAA", after: "AAAA" }] };
  let text = "AAA";
  const port: TextPort = { context: vi.fn(async () => context), read: vi.fn(async () => text), write: vi.fn(async (_id, value) => { text = value; }) };
  const events: AuditEvent[] = [];
  const store: AuditStore = { load: () => [...events], append: event => { events.push(event); } };
  return { context, plan, port, events, store };
}
describe("confirmed Designer writes", () => {
  it("awaits central audit persistence and blocks a write when dispatch recording fails", async () => {
    const f = fixture();
    f.store.load = async () => f.events;
    f.store.append = async event => { await Promise.resolve(); if (event.status === "dispatching") throw new Error("offline"); f.events.push(event); };
    await expect(applyPlan(f.plan, true, f.port, f.store)).rejects.toThrow("offline");
    expect(f.port.write).not.toHaveBeenCalled();
  });
  it("requires confirmation and a valid non-expired preview", async () => {
    const f = fixture();
    await expect(applyPlan(f.plan, false, f.port, f.store)).rejects.toThrow("Confirme");
    await expect(applyPlan({ ...f.plan, expiresAt: 0 }, true, f.port, f.store)).rejects.toThrow("expirada");
    expect(f.port.write).not.toHaveBeenCalled();
  });
  it("records intent before write and replays without duplicating a replacement", async () => {
    const f = fixture();
    const write = f.port.write;
    f.port.write = vi.fn(async (id, value) => { expect(f.events.at(-1)?.status).toBe("dispatching"); await write(id, value); });
    await applyPlan(f.plan, true, f.port, f.store);
    await applyPlan(f.plan, true, f.port, f.store);
    expect(f.port.write).toHaveBeenCalledTimes(1);
    expect(f.events.at(-1)?.status).toBe("applied");
  });
  it("blocks changed pages and edited or missing nodes", async () => {
    const f = fixture();
    f.port.context = async () => ({ ...f.context, pageId: "other" });
    await expect(applyPlan(f.plan, true, f.port, f.store)).rejects.toThrow("contexto mudou");
    f.port.context = async () => f.context;
    f.port.read = async () => null;
    await expect(applyPlan(f.plan, true, f.port, f.store)).rejects.toThrow("mudou");
    expect(f.port.write).not.toHaveBeenCalled();
  });
  it("does not report a completed write as verified if someone reverted the text", async () => {
    const f = fixture();
    await applyPlan(f.plan, true, f.port, f.store);
    f.port.read = async () => "AAA";
    await expect(applyPlan(f.plan, true, f.port, f.store)).rejects.toThrow("mudou");
    expect(f.port.write).toHaveBeenCalledTimes(1);
  });
  it("fails closed if durable audit cannot be saved", async () => {
    const f = fixture();
    f.store.append = () => { throw new Error("storage full"); };
    await expect(applyPlan(f.plan, true, f.port, f.store)).rejects.toThrow("storage full");
    expect(f.port.write).not.toHaveBeenCalled();
  });
  it("never blindly retries a dispatched write after a timeout", async () => {
    const f = fixture();
    f.port.write = vi.fn(async () => { throw new Error("timeout"); });
    await expect(applyPlan(f.plan, true, f.port, f.store)).rejects.toThrow("confirmar o resultado");
    await expect(applyPlan(f.plan, true, f.port, f.store)).rejects.toThrow("incerto");
    expect(f.port.write).toHaveBeenCalledTimes(1);
  });
  it("reconciles a timeout after an effective write by reading, without resending", async () => {
    const f = fixture();
    f.port.write = vi.fn(async () => { f.port.read = async () => "AAAA"; throw new Error("timeout"); });
    await expect(applyPlan(f.plan, true, f.port, f.store)).rejects.toThrow();
    await applyPlan(f.plan, true, f.port, f.store);
    expect(f.port.write).toHaveBeenCalledTimes(1);
    expect(f.events.at(-1)?.status).toBe("already_applied");
  });
  it("preflights the entire batch before the first write", async () => {
    const f = fixture();
    f.plan.changes.push({ id: "b", before: "BBB", after: "CCC" });
    await expect(applyPlan(f.plan, true, f.port, f.store)).rejects.toThrow();
    expect(f.port.write).not.toHaveBeenCalled();
  });
});
