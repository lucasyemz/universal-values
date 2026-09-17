import { describe, expect, it } from "vitest";
import { groupScanResults, valuePreviewValidationError, type Occurrence } from "./schema";
import { fillOccurrenceValues, isRepeatedGroupSelection } from "./changes";

describe("results by selected detection type", () => {
  it.each(["link", "image", "text"] as const)("separates equal %s values and excludes unique values from bulk editors", (type) => {
    const canonical = (value: string) => type === "text" ? { type, text: value } : { type, url: "https://example.com/" + value };
    const rows = ["a", "a", "b", "b", "unique"].map((value, index) => ({ id: String(index), source_key: "field-" + index, canonical: canonical(value) } as Occurrence));
    const section = groupScanResults({ plan: [{ id: "a".repeat(24), name: "CMS", types: [type] }] }, rows, rows)[0]!;
    expect(section.duplicates.map((group) => group.occurrences.map((o) => o.id))).toEqual([["0", "1"], ["2", "3"]]);
    expect(fillOccurrenceValues(section.duplicates[0]!.occurrences, {}, "new")).toEqual({ "0": "new", "1": "new" });
    expect(() => fillOccurrenceValues(rows, {}, "new")).toThrow("valores originais iguais");
    expect(isRepeatedGroupSelection(rows, ["0"])).toBe(true);
    expect(isRepeatedGroupSelection(rows, ["0", "1"])).toBe(true);
    expect(isRepeatedGroupSelection(rows, ["0", "2"])).toBe(false);
    expect(isRepeatedGroupSelection(rows, ["4"])).toBe(false);
  });
  it("keeps selected empty categories and separates duplicates from eligible groups", () => {
    const row = { id: "1", source_key: "gallery", canonical: { type: "image", url: "https://example.com/a.png" } } as Occurrence;
    const rows = [row, { ...row, id: "2" }];
    const result = groupScanResults({ plan: [{ id: "a".repeat(24), name: "CMS", types: ["link", "image"] }] }, rows, []);
    expect(result.map((s) => s.type)).toEqual(["link", "image"]);
    expect(result[0]?.occurrences).toEqual([]);
    expect(result[1]?.duplicates).toHaveLength(1);
    expect(result[1]?.groups).toEqual([]);
    expect(result[1]?.boundCount).toBe(2);
  });
  it("retains legacy detection types for old plans", () => {
    const result = groupScanResults({ plan: [{ id: "a".repeat(24), name: "CMS" }] }, [], []);
    expect(result.map((s) => s.type)).toEqual(["money", "phone", "date", "number", "text"]);
  });
});

describe("review validation feedback", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const payload = { id, scanId: id, name: "Link de cadastro", occurrenceIds: [id, "22222222-2222-4222-8222-222222222222"] };
  it("accepts a label without requiring any replacement value", () => {
    expect(valuePreviewValidationError(payload)).toBeNull();
  });
  it("identifies missing selections and invalid names separately", () => {
    expect(valuePreviewValidationError({ ...payload, occurrenceIds: [] })).toBe("selection");
    expect(valuePreviewValidationError({ ...payload, name: "x".repeat(81) })).toBe("name");
    expect(valuePreviewValidationError({ ...payload, id: "bad" })).toBe("invalid");
  });
});
