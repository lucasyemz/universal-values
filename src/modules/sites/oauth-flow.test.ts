import { describe, expect, it, vi } from "vitest";
import { finishOAuth } from "./oauth-flow";
import { confirmSiteSchema, safeOffset, startConnectionSchema } from "./schema";

describe("OAuth callback orchestration", () => {
  it("exchanges and saves only after a committed claim", async () => {
    const order: string[] = [];
    await finishOAuth({
      claim: async () => { order.push("claim"); return "claimed"; },
      exchange: async () => { order.push("exchange"); return "token"; },
      save: async (token) => { expect(token).toBe("token"); order.push("save"); },
    });
    expect(order).toEqual(["claim", "exchange", "save"]);
  });
  it("does not repeat token exchange for a completed callback", async () => {
    const exchange = vi.fn();
    const save = vi.fn();
    await finishOAuth({ claim: async () => "ready", exchange, save });
    expect(exchange).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
  it("rejects competing callbacks without exchanging a code again", async () => {
    const exchange = vi.fn();
    await expect(finishOAuth({ claim: async () => "busy", exchange, save: vi.fn() })).rejects.toThrow();
    expect(exchange).not.toHaveBeenCalled();
  });
  it("does not retry an uncertain provider failure", async () => {
    const exchange = vi.fn().mockRejectedValue(new Error("timeout"));
    const save = vi.fn();
    await expect(finishOAuth({ claim: async () => "claimed", exchange, save })).rejects.toThrow("timeout");
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });
  it("rejects tampering and requires confirmation", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(confirmSiteSchema.safeParse({ id }).success).toBe(false);
    expect(confirmSiteSchema.safeParse({ id, confirmed: "yes", siteId: "modified" }).success).toBe(false);
    expect(startConnectionSchema.safeParse({ id, workspaceId: id, confirmed: "yes" }).success).toBe(true);
    expect(startConnectionSchema.safeParse({ id, workspaceId: id, confirmed: "no" }).success).toBe(false);
    expect(safeOffset("-1")).toBe(0);
    expect(safeOffset("25")).toBe(25);
  });
});
