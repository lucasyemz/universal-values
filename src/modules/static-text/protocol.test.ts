import { describe, it, expect } from "vitest";
import { allowedDesignerOrigin, gatewaySchema, sessionCodeSchema } from "./protocol";
describe("Designer API boundary", () => {
  it("requires exact allowed origins", () => {
    const allow = "http://localhost:1337,https://example.webflow-ext.com";
    expect(allowedDesignerOrigin("http://localhost:1337", allow)).toBe(true);
    expect(allowedDesignerOrigin("https://example.webflow-ext.com", allow)).toBe(true);
    for (const origin of [null, "null", "https://example.webflow-ext.com.evil.test", "https://evil.test"]) expect(allowedDesignerOrigin(origin, allow)).toBe(false);
  });
  it("validates capability format and disallows arbitrary gateway operations", () => {
    expect(sessionCodeSchema.safeParse("uvd_" + "a".repeat(64)).success).toBe(true);
    expect(sessionCodeSchema.safeParse("short").success).toBe(false);
    expect(gatewaySchema.safeParse({ action: "write", webflowSiteId: "a".repeat(24) }).success).toBe(false);
  });
});
