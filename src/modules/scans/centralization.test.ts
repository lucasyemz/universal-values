import { describe, expect, it } from "vitest";
import { centralizationOptions, scanEditingOptions } from "./centralization";
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

it("includes free text from managed fields in bulk editing and excludes only protected occurrences", () => {
  const occurrences = ["one", "two", "protected", "unbound"].map((id,index) => ({ id, source_key: index === 3 ? "other" : "managed" }) as Occurrence);
  const linked = { managed: { id: "value", name: "Buy it" } };
  const selection = scanEditingOptions(occurrences,linked,["one","two"]);
  expect(selection.available.map(o => o.id)).toEqual(["one","two","unbound"]);
  expect([...selection.protectedIds]).toEqual(["protected"]);
  expect(scanEditingOptions(occurrences,linked,[]).available.map(o=>o.id)).toEqual(["unbound"]);
});
