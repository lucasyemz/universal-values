import { describe, expect, it } from "vitest";
import { parseWebflowRateLimit } from "./rate-limit";
import { WebflowReader } from "./client";
describe("Webflow quota observations", () => {
  it("does not turn absent or invalid provider data into a balance", () => {
    for (const pair of [[null, null], ["", ""], ["60", "-1"], ["60", "61"], ["60", "NaN"]]) {
      const headers = new Headers();
      if (pair[0] !== null) headers.set("x-ratelimit-limit", pair[0]!);
      if (pair[1] !== null) headers.set("x-ratelimit-remaining", pair[1]!);
      expect(parseWebflowRateLimit(headers)).toBeNull();
    }
  });
  it("preserves an exhausted allowance", () => {
    expect(parseWebflowRateLimit(new Headers({ "x-ratelimit-limit": "60", "x-ratelimit-remaining": "0" }))).toEqual({ limit: 60, remaining: 0 });
  });
  it("reads safe headers on 429 without retrying or consuming the body", async () => {
    let calls = 0;
    const reader = new WebflowReader("test", async () => {
      calls++;
      return new Response("provider details", { status: 429, headers: { "x-ratelimit-limit": "60", "x-ratelimit-remaining": "0" } });
    });
    expect(await reader.rateLimit("a".repeat(24))).toEqual({ limit: 60, remaining: 0 });
    expect(calls).toBe(1);
  });
});
