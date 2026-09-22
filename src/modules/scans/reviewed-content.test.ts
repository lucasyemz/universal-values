import { describe, expect, it } from "vitest";
import { groupScanResults, type Occurrence } from "./schema";
import { countReviewedOccurrences, filterReviewedGroups } from "./reviewed-content";

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

describe("review counters", () => {
  it("counts occurrences, ignores stale review IDs and deduplicates", () => {
    expect(countReviewedOccurrences(sections, ["old-a", "old-a", "missing"])).toEqual({ pending: 2, reviewed: 1, all: 3 });
    expect(countReviewedOccurrences([], ["old-a"])).toEqual({ pending: 0, reviewed: 0, all: 0 });
    expect(countReviewedOccurrences(sections, rows.map(o => o.id))).toEqual({ pending: 0, reviewed: 3, all: 3 });
  });
});
it("keeps the last repeated image pending after applying only its peer", () => {
 const images = rows.slice(0,2).map(o=>({...o,canonical:{type:"image" as const,url:"https://cdn.example/image.png"}}));
 const groups=groupScanResults({plan:[{id:"a".repeat(24),name:"CMS",types:["image"]}]},images,images);
 expect(filterReviewedGroups(groups,[images[0]!.id],"pending")[0]?.duplicates[0]?.occurrences.map(o=>o.id)).toEqual([images[1]!.id]);
 expect(countReviewedOccurrences(groups,[images[0]!.id])).toEqual({pending:1,reviewed:1,all:2});
});
