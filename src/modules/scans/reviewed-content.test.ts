import { describe, expect, it } from "vitest";
import { groupScanResults, type Occurrence } from "./schema";
import { filterReviewedGroups } from "./reviewed-content";

const rows = ["old-a", "old-b", "new-c"].map((id) => ({ id, source_key: id, canonical: { type: "link", url: "https://example.com/join" } } as Occurrence));
const sections = groupScanResults({ plan: [{ id: "a".repeat(24), name: "CMS", types: ["link"] }] }, rows, rows);
describe("reviewed content filters", () => {
  it("keeps a new occurrence visible even when all other repeats are reviewed", () => {
    expect(filterReviewedGroups(sections, ["old-a", "old-b"], "pending")[0]?.duplicates[0]?.occurrences.map((o) => o.id)).toEqual(["new-c"]);
  });
  it("restores reviewed sources through Reviewed and All without changing group identity", () => {
    expect(filterReviewedGroups(sections, ["old-a", "old-b"], "reviewed")[0]?.duplicates[0]?.occurrences.map((o) => o.id)).toEqual(["old-a", "old-b"]);
    expect(filterReviewedGroups(sections, ["old-a", "old-b"], "all")[0]?.duplicates[0]?.occurrences).toHaveLength(3);
    expect(filterReviewedGroups(sections, rows.map((o) => o.id), "pending")[0]?.duplicates).toEqual([]);
    expect(sections[0]?.duplicates[0]?.occurrences).toHaveLength(3);
  });
});
