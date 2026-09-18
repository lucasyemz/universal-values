import { describe, expect, it } from "vitest";
import { centralizationOptions } from "./centralization";
import type { Occurrence } from "./schema";

const rows = ["a", "a", "b"].map((source_key, index) => ({ id: String(index), source_key }) as Occurrence);
describe("centralization choices", () => {
  it("requires two distinct unbound fields, not merely two occurrences", () => {
    expect(centralizationOptions(rows.slice(0, 2), {}).eligible).toBe(false);
    expect(centralizationOptions(rows, {}).eligible).toBe(true);
    const result = centralizationOptions(rows, { b: { id: "value", name: "Phone" } });
    expect(result.available).toEqual(rows.slice(0, 2));
    expect(result.eligible).toBe(false);
  });
});
