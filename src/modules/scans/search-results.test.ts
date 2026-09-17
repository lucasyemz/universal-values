import { describe, expect, it } from "vitest";
import { groupScanResults, type Occurrence } from "./schema";
import { resultsSearchSchema, searchResultGroups } from "./search-results";

describe("search scan results", () => {
  const rows = ["Parceira Acme", "Outra Acme", "Outra empresa"].flatMap((text, index) =>
    [1, 2].map((n) => ({ id: `${index}-${n}`, source_key: `${index}-${n}`, canonical: { type: "text", text }, field_type: "PlainText", source_value: text, raw_match: text, start_pos: 0, end_pos: [...text].length } as Occurrence)));
  const sections = groupScanResults({ plan: [] }, rows, rows);

  it("finds partial text without combining different values or dropping peers", () => {
    const groups = searchResultGroups(sections, "ACME")[0]!.duplicates;
    expect(groups.map((g) => g.label)).toEqual(["Parceira Acme", "Outra Acme"]);
    expect(groups.every((g) => g.occurrences.length === 2)).toBe(true);
    expect(sections[0]!.duplicates).toHaveLength(3);
  });

  it("supports empty and unmatched queries and validates the input", () => {
    expect(searchResultGroups(sections, "")).toBe(sections);
    expect(searchResultGroups(sections, "inexistente")[0]!.duplicates).toEqual([]);
    expect(resultsSearchSchema.parse("  Acme  ")).toBe("Acme");
    expect(resultsSearchSchema.parse(["Acme"])).toBe("");
  });
});
